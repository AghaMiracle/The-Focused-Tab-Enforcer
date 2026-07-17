const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const logger = require('../utils/logger');
const MonitoringSession = require('../models/MonitoringSession');
const RealtimeAlert = require('../models/RealtimeAlert');
const Admin = require('../models/Admin');
const Institution = require('../models/Institution');

/**
 * Initialize Socket.io with the /admin-dashboard namespace.
 * @param {http.Server} httpServer
 * @returns {Server} io
 */
const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  const adminDashboard = io.of('/admin-dashboard');

  // Authenticate socket connections via JWT in handshake
  adminDashboard.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication token is required.'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next(new Error('Invalid or expired token.'));
    }

    try {
      let user, institutionId;

      if (decoded.type === 'institution') {
        user = await Institution.findById(decoded.id).select('name email isActive');
        if (!user || !user.isActive) return next(new Error('Institution not found or inactive.'));
        institutionId = user._id;
      } else if (decoded.type === 'admin') {
        user = await Admin.findById(decoded.id).select('fullName email role institutionId isActive');
        if (!user || !user.isActive) return next(new Error('Admin not found or inactive.'));
        institutionId = user.institutionId;
      } else {
        return next(new Error('Invalid token type for dashboard.'));
      }

      socket.user = user;
      socket.userType = decoded.type;
      socket.institutionId = institutionId.toString();
      next();
    } catch (err) {
      logger.error(`Socket auth error: ${err.message}`);
      next(new Error('Authentication failed.'));
    }
  });

  adminDashboard.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} — institution: ${socket.institutionId}`);

    // Auto-join institution room on connect
    const room = `institution:${socket.institutionId}`;
    socket.join(room);
    socket.emit('server:connected', {
      message: 'Connected to admin dashboard',
      room,
      institutionId: socket.institutionId,
    });

    // Handle admin joining a room explicitly
    socket.on('admin:join-room', (data) => {
      socket.join(room);
      logger.info(`Admin ${socket.id} joined room ${room}`);
    });

    // Handle alert acknowledgement
    socket.on('admin:acknowledge-alert', async (data) => {
      const { alertId } = data;
      if (!alertId) return;

      try {
        const alert = await RealtimeAlert.findByIdAndUpdate(
          alertId,
          {
            isAcknowledged: true,
            isRead: true,
            acknowledgedBy: socket.user._id,
            acknowledgedAt: new Date(),
          },
          { new: true }
        );

        if (alert) {
          adminDashboard.to(room).emit('server:alert-acknowledged', {
            alertId,
            acknowledgedBy: socket.user.fullName || socket.user.name,
            acknowledgedAt: alert.acknowledgedAt,
          });
        }
      } catch (err) {
        logger.error(`Alert acknowledge error: ${err.message}`);
      }
    });

    // Handle admin force-terminating a student session
    socket.on('admin:terminate-session', async (data) => {
      const { sessionId, reason } = data;
      if (!sessionId) return;

      try {
        const session = await MonitoringSession.findByIdAndUpdate(
          sessionId,
          {
            status: 'terminated',
            endedAt: new Date(),
            endReason: 'admin_terminated',
          },
          { new: true }
        );

        if (session) {
          // Notify the entire institution room
          adminDashboard.to(room).emit('server:session-terminated', {
            sessionId,
            reason: reason || 'Terminated by admin',
            terminatedBy: socket.user.fullName || socket.user.name,
            timestamp: new Date(),
          });
          logger.info(`Session ${sessionId} terminated by admin ${socket.id}`);
        }
      } catch (err) {
        logger.error(`Session termination error: ${err.message}`);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} — reason: ${reason}`);
    });

    socket.on('error', (err) => {
      logger.error(`Socket error: ${socket.id} — ${err.message}`);
    });
  });

  // Periodic heartbeat broadcast: active session count every 30s
  setInterval(async () => {
    try {
      const activeSessions = await MonitoringSession.countDocuments({ status: 'active' });
      io.of('/admin-dashboard').emit('server:heartbeat', {
        activeSessions,
        timestamp: new Date(),
      });
    } catch {}
  }, 30000);

  logger.info('Socket.io initialized — namespace: /admin-dashboard');
  return io;
};

module.exports = { initSocket };
