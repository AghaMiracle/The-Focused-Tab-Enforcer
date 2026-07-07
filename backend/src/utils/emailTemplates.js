/**
 * Email HTML templates for Focused Tab Enforcer
 */

const baseLayout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Focused Tab Enforcer</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a1a2e; padding: 28px 32px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; }
    .header span { color: #6c63ff; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .body h2 { color: #1a1a2e; margin-top: 0; }
    .btn { display: inline-block; padding: 12px 28px; background: #6c63ff; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .info-box { background: #f0f4ff; border-left: 4px solid #6c63ff; padding: 16px; border-radius: 4px; margin: 16px 0; }
    .stat { display: inline-block; text-align: center; padding: 12px 24px; background: #f4f6f9; border-radius: 6px; margin: 4px; }
    .stat-value { font-size: 24px; font-weight: 700; color: #1a1a2e; }
    .stat-label { font-size: 12px; color: #666; }
    .footer { padding: 20px 32px; background: #f4f6f9; text-align: center; font-size: 12px; color: #888; }
    .alert-high { border-left-color: #e53e3e; background: #fff5f5; }
    .alert-medium { border-left-color: #dd6b20; background: #fffaf0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Focused <span>Tab</span> Enforcer</h1>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated message from Focused Tab Enforcer. Please do not reply.</p>
      <p>&copy; ${new Date().getFullYear()} Focused Tab Enforcer. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const welcomeEmail = ({ institutionName }) =>
  baseLayout(`
    <h2>Welcome to Focused Tab Enforcer! 🎉</h2>
    <p>Hello <strong>${institutionName}</strong>,</p>
    <p>Your institution has been successfully registered. You can now start creating exams and monitoring students with our AI-powered attention detection system.</p>
    <div class="info-box">
      <strong>Getting Started:</strong>
      <ol>
        <li>Log in to your dashboard</li>
        <li>Add your students</li>
        <li>Create your first exam</li>
        <li>Install the browser extension</li>
      </ol>
    </div>
    <p>If you have any questions, contact our support team.</p>
  `);

const passwordResetEmail = ({ resetUrl, expiresIn = '1 hour' }) =>
  baseLayout(`
    <h2>Password Reset Request</h2>
    <p>You requested a password reset. Click the button below to set a new password:</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </p>
    <div class="info-box">
      <strong>Note:</strong> This link expires in <strong>${expiresIn}</strong>. If you did not request this, please ignore this email.
    </div>
    <p>If the button doesn't work, copy and paste this URL into your browser:</p>
    <p style="word-break: break-all; font-size: 12px; color: #666;">${resetUrl}</p>
  `);

const examReminderEmail = ({ studentName, examTitle, scheduledDate, durationMinutes, examId }) =>
  baseLayout(`
    <h2>Exam Reminder 📝</h2>
    <p>Hello <strong>${studentName}</strong>,</p>
    <p>This is a reminder that you have an upcoming exam scheduled:</p>
    <div class="info-box">
      <strong>Exam:</strong> ${examTitle}<br />
      <strong>Exam ID:</strong> ${examId}<br />
      <strong>Date:</strong> ${new Date(scheduledDate).toLocaleString()}<br />
      <strong>Duration:</strong> ${durationMinutes} minutes
    </div>
    <p>Please ensure you have the Focused Tab Enforcer browser extension installed before the exam.</p>
    <p><strong>Important:</strong> Keep only the exam tab open during the session. Any tab switching or window blurring will be flagged as a violation.</p>
  `);

const dailySummaryEmail = ({ institutionName, date, stats }) =>
  baseLayout(`
    <h2>Daily Activity Summary</h2>
    <p>Hello <strong>${institutionName}</strong>,</p>
    <p>Here's a summary of exam activity for <strong>${date}</strong>:</p>
    <div style="text-align: center; margin: 24px 0;">
      <div class="stat">
        <div class="stat-value">${stats.totalExams}</div>
        <div class="stat-label">Exams Conducted</div>
      </div>
      <div class="stat">
        <div class="stat-value">${stats.totalStudents}</div>
        <div class="stat-label">Students Monitored</div>
      </div>
      <div class="stat">
        <div class="stat-value">${stats.totalViolations}</div>
        <div class="stat-label">Total Violations</div>
      </div>
      <div class="stat">
        <div class="stat-value">${stats.highSeverityViolations}</div>
        <div class="stat-label">High Severity</div>
      </div>
    </div>
    <p>Log in to your dashboard to view detailed reports and violation timelines.</p>
  `);

const highSeverityAlertEmail = ({ adminName, studentName, examTitle, violationType, severity, timestamp, message }) =>
  baseLayout(`
    <h2>⚠️ High Severity Violation Alert</h2>
    <p>Hello <strong>${adminName}</strong>,</p>
    <p>A high-severity violation has been detected during an active exam session:</p>
    <div class="info-box alert-high">
      <strong>Student:</strong> ${studentName}<br />
      <strong>Exam:</strong> ${examTitle}<br />
      <strong>Violation Type:</strong> ${violationType.replace(/_/g, ' ').toUpperCase()}<br />
      <strong>Severity:</strong> ${severity.toUpperCase()}<br />
      <strong>Time:</strong> ${new Date(timestamp).toLocaleString()}<br />
      <strong>Details:</strong> ${message}
    </div>
    <p>Please log in to your dashboard to review and take appropriate action.</p>
  `);

module.exports = {
  welcomeEmail,
  passwordResetEmail,
  examReminderEmail,
  dailySummaryEmail,
  highSeverityAlertEmail,
};
