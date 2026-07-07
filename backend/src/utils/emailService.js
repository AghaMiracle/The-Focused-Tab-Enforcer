const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter = null;

/**
 * Lazy-initialize transporter to avoid errors on startup
 * if SMTP credentials aren't configured yet.
 */
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

/**
 * Send an email.
 * @param {Object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Focused Tab Enforcer'}" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
    });
    logger.info(`Email sent to ${to} — MessageId: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`Failed to send email to ${to}: ${err.message}`);
    // Don't throw — email failures shouldn't break the request flow
    return null;
  }
};

/**
 * Send a welcome email to a newly registered institution.
 */
const sendWelcomeEmail = async (institution) => {
  const { welcomeEmail } = require('./emailTemplates');
  return sendEmail({
    to: institution.email,
    subject: 'Welcome to Focused Tab Enforcer',
    html: welcomeEmail({ institutionName: institution.name }),
  });
};

/**
 * Send password reset email.
 */
const sendPasswordResetEmail = async ({ email, resetUrl }) => {
  const { passwordResetEmail } = require('./emailTemplates');
  return sendEmail({
    to: email,
    subject: 'Password Reset — Focused Tab Enforcer',
    html: passwordResetEmail({ resetUrl }),
  });
};

/**
 * Send exam reminder to a student.
 */
const sendExamReminderEmail = async ({ studentEmail, studentName, examTitle, scheduledDate, durationMinutes, examId }) => {
  const { examReminderEmail } = require('./emailTemplates');
  return sendEmail({
    to: studentEmail,
    subject: `Exam Reminder: ${examTitle}`,
    html: examReminderEmail({ studentName, examTitle, scheduledDate, durationMinutes, examId }),
  });
};

/**
 * Send daily summary to institution admins.
 */
const sendDailySummaryEmail = async ({ adminEmail, institutionName, date, stats }) => {
  const { dailySummaryEmail } = require('./emailTemplates');
  return sendEmail({
    to: adminEmail,
    subject: `Daily Exam Summary — ${date}`,
    html: dailySummaryEmail({ institutionName, date, stats }),
  });
};

/**
 * Send high-severity alert email to admins.
 */
const sendHighSeverityAlertEmail = async ({ adminEmail, adminName, studentName, examTitle, violationType, severity, timestamp, message }) => {
  const { highSeverityAlertEmail } = require('./emailTemplates');
  return sendEmail({
    to: adminEmail,
    subject: `🚨 High Severity Alert: ${examTitle}`,
    html: highSeverityAlertEmail({ adminName, studentName, examTitle, violationType, severity, timestamp, message }),
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendExamReminderEmail,
  sendDailySummaryEmail,
  sendHighSeverityAlertEmail,
};
