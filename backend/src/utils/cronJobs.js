const cron = require('node-cron');
const logger = require('./logger');

let io = null; // Socket.io instance, injected after init

/**
 * Inject the Socket.io instance so cron jobs can emit events.
 */
const setSocketIo = (socketIo) => {
  io = socketIo;
};

/**
 * Auto-start exams that have reached their scheduled date.
 * Runs every hour.
 */
const autoStartExams = cron.schedule(
  '0 * * * *',
  async () => {
    try {
      const Exam = require('../models/Exam');
      const now = new Date();

      const examsToStart = await Exam.find({
        status: 'scheduled',
        scheduledDate: { $lte: now },
      });

      if (examsToStart.length === 0) return;

      for (const exam of examsToStart) {
        exam.status = 'active';
        exam.activatedAt = now;
        await exam.save();
        logger.info(`[CRON] Auto-started exam: ${exam.examId} — ${exam.title}`);

        if (io) {
          io.to(`institution:${exam.institutionId}`).emit('server:exam-started', {
            examId: exam._id,
            examCode: exam.examId,
            title: exam.title,
          });
        }
      }

      logger.info(`[CRON] Auto-started ${examsToStart.length} exam(s)`);
    } catch (err) {
      logger.error(`[CRON] autoStartExams error: ${err.message}`);
    }
  },
  { scheduled: false }
);

/**
 * Auto-end exams that have exceeded duration + 15-minute grace period.
 * Runs every hour.
 */
const autoEndExams = cron.schedule(
  '30 * * * *',
  async () => {
    try {
      const Exam = require('../models/Exam');
      const ExamEnrollment = require('../models/ExamEnrollment');
      const MonitoringSession = require('../models/MonitoringSession');
      const now = new Date();

      const activeExams = await Exam.find({ status: 'active' });

      for (const exam of activeExams) {
        const gracePeriodMs = (exam.durationMinutes + 15) * 60 * 1000;
        const activatedAt = exam.activatedAt || exam.scheduledDate;
        if (now - activatedAt >= gracePeriodMs) {
          exam.status = 'completed';
          exam.completedAt = now;
          await exam.save();

          // End all active monitoring sessions for this exam
          const enrollments = await ExamEnrollment.find({ examId: exam._id }).select('_id');
          const enrollmentIds = enrollments.map((e) => e._id);

          await MonitoringSession.updateMany(
            { examEnrollmentId: { $in: enrollmentIds }, status: 'active' },
            { status: 'completed', endedAt: now, endReason: 'timeout' }
          );

          await ExamEnrollment.updateMany(
            { examId: exam._id, enrollmentStatus: 'in_progress' },
            { enrollmentStatus: 'completed', submittedAt: now }
          );

          logger.info(`[CRON] Auto-ended exam: ${exam.examId} — ${exam.title}`);

          if (io) {
            io.to(`institution:${exam.institutionId}`).emit('server:exam-ended', {
              examId: exam._id,
              examCode: exam.examId,
              title: exam.title,
            });
          }
        }
      }
    } catch (err) {
      logger.error(`[CRON] autoEndExams error: ${err.message}`);
    }
  },
  { scheduled: false }
);

/**
 * Send exam reminders 24 hours before scheduled start.
 * Runs every hour.
 */
const sendExamReminders = cron.schedule(
  '15 * * * *',
  async () => {
    try {
      const Exam = require('../models/Exam');
      const ExamEnrollment = require('../models/ExamEnrollment');
      const Student = require('../models/Student');
      const { sendExamReminderEmail } = require('./emailService');

      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);

      const upcomingExams = await Exam.find({
        status: 'scheduled',
        scheduledDate: { $gte: in23h, $lte: in24h },
      });

      for (const exam of upcomingExams) {
        const enrollments = await ExamEnrollment.find({ examId: exam._id }).populate('studentId');

        for (const enrollment of enrollments) {
          const student = enrollment.studentId;
          if (student && student.email) {
            await sendExamReminderEmail({
              studentEmail: student.email,
              studentName: student.fullName,
              examTitle: exam.title,
              scheduledDate: exam.scheduledDate,
              durationMinutes: exam.durationMinutes,
              examId: exam.examId,
            });
          }
        }

        logger.info(`[CRON] Sent reminders for exam: ${exam.examId} — ${enrollments.length} students`);
      }
    } catch (err) {
      logger.error(`[CRON] sendExamReminders error: ${err.message}`);
    }
  },
  { scheduled: false }
);

/**
 * Send daily summary emails to institution admins.
 * Runs daily at midnight.
 */
const sendDailySummaries = cron.schedule(
  '0 0 * * *',
  async () => {
    try {
      const Institution = require('../models/Institution');
      const Admin = require('../models/Admin');
      const Exam = require('../models/Exam');
      const ExamEnrollment = require('../models/ExamEnrollment');
      const ViolationEvent = require('../models/ViolationEvent');
      const { sendDailySummaryEmail } = require('./emailService');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const today = new Date(yesterday);
      today.setDate(today.getDate() + 1);

      const institutions = await Institution.find({ isActive: true });

      for (const institution of institutions) {
        const exams = await Exam.find({
          institutionId: institution._id,
          completedAt: { $gte: yesterday, $lt: today },
        });

        if (exams.length === 0) continue;

        const examIds = exams.map((e) => e._id);
        const enrollments = await ExamEnrollment.find({ examId: { $in: examIds } });
        const enrollmentIds = enrollments.map((e) => e._id);

        const violations = await ViolationEvent.find({
          examEnrollmentId: { $in: enrollmentIds },
          timestamp: { $gte: yesterday, $lt: today },
        });

        const highSeverity = violations.filter((v) => v.severity === 'high').length;

        const stats = {
          totalExams: exams.length,
          totalStudents: enrollments.length,
          totalViolations: violations.length,
          highSeverityViolations: highSeverity,
        };

        const dateStr = yesterday.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const superAdmins = await Admin.find({ institutionId: institution._id, role: 'super_admin', isActive: true });

        for (const admin of superAdmins) {
          await sendDailySummaryEmail({
            adminEmail: admin.email,
            institutionName: institution.name,
            date: dateStr,
            stats,
          });
        }
      }

      logger.info('[CRON] Daily summaries sent');
    } catch (err) {
      logger.error(`[CRON] sendDailySummaries error: ${err.message}`);
    }
  },
  { scheduled: false }
);

/**
 * Clean up stale/inactive monitoring sessions (no heartbeat for 10+ minutes).
 * Runs every 15 minutes.
 */
const cleanupStaleSessions = cron.schedule(
  '*/15 * * * *',
  async () => {
    try {
      const MonitoringSession = require('../models/MonitoringSession');
      const threshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      const result = await MonitoringSession.updateMany(
        {
          status: 'active',
          lastHeartbeatAt: { $lt: threshold },
        },
        { status: 'terminated', endedAt: new Date(), endReason: 'timeout' }
      );

      if (result.modifiedCount > 0) {
        logger.info(`[CRON] Cleaned up ${result.modifiedCount} stale session(s)`);
      }
    } catch (err) {
      logger.error(`[CRON] cleanupStaleSessions error: ${err.message}`);
    }
  },
  { scheduled: false }
);

/**
 * Start all cron jobs.
 */
const startAll = () => {
  autoStartExams.start();
  autoEndExams.start();
  sendExamReminders.start();
  sendDailySummaries.start();
  cleanupStaleSessions.start();
  logger.info('[CRON] All cron jobs started');
};

/**
 * Stop all cron jobs (useful for graceful shutdown).
 */
const stopAll = () => {
  autoStartExams.stop();
  autoEndExams.stop();
  sendExamReminders.stop();
  sendDailySummaries.stop();
  cleanupStaleSessions.stop();
  logger.info('[CRON] All cron jobs stopped');
};

module.exports = { startAll, stopAll, setSocketIo };
