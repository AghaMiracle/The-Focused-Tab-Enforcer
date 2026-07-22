/**
 * emailService.js
 * Transactional email via Gmail SMTP (nodemailer).
 *
 * Required env vars:
 *   GMAIL_USER          — Your Gmail address (e.g. you@gmail.com)
 *   GMAIL_APP_PASSWORD  — Gmail App Password (16-char, from Google Account
 *                         Security → 2-Step Verification → App passwords)
 *   EMAIL_FROM          — Sender address (defaults to GMAIL_USER)
 *   EMAIL_FROM_NAME     — Display name (default: Focused Tab Enforcer)
 *
 * Gmail App Passwords (required — regular passwords no longer work):
 *   https://myaccount.google.com/apppasswords
 *
 * You must have 2-Step Verification enabled to create an App Password.
 *
 * Gmail SMTP limits:
 *   - 500 recipients/day (free Gmail)
 *   - 2000 recipients/day (Google Workspace)
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

// ─── Lazy singleton transporter ───────────────────────────────────────────────
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      'GMAIL_USER and GMAIL_APP_PASSWORD must be set in your .env file.\n' +
      'Create an App Password at: https://myaccount.google.com/apppasswords\n' +
      '(Requires 2-Step Verification enabled.)'
    );
  }

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return _transporter;
}

// ─── Core send ────────────────────────────────────────────────────────────────

/**
 * Send a transactional email via Gmail SMTP.
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 * @returns {Promise<object|null>}
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = getTransporter();

    const from = `"${process.env.EMAIL_FROM_NAME || 'Focused Tab Enforcer'}" <${
      process.env.EMAIL_FROM || process.env.GMAIL_USER
    }>`;

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
    });

    logger.info(`[Gmail] Sent to ${to} — messageId: ${info?.messageId ?? 'n/a'}`);
    return info;
  } catch (err) {
    logger.error(`[Gmail] Failed to send to ${to}: ${err.message}`);
    return null; // never throw — email failure must not break request flow
  }
};

// ─── Named helpers ────────────────────────────────────────────────────────────

const sendWelcomeEmail = (institution) => {
  const { welcomeEmail } = require('./emailTemplates');
  return sendEmail({
    to:      institution.email,
    subject: 'Welcome to Focused Tab Enforcer',
    html:    welcomeEmail({ institutionName: institution.name }),
  });
};

const sendPasswordResetEmail = ({ email, resetUrl }) => {
  const { passwordResetEmail } = require('./emailTemplates');
  return sendEmail({
    to:      email,
    subject: 'Password Reset — Focused Tab Enforcer',
    html:    passwordResetEmail({ resetUrl }),
  });
};

const sendExamReminderEmail = ({ studentEmail, studentName, examTitle, scheduledDate, durationMinutes, examId }) => {
  const { examReminderEmail } = require('./emailTemplates');
  return sendEmail({
    to:      studentEmail,
    subject: `Exam Reminder: ${examTitle}`,
    html:    examReminderEmail({ studentName, examTitle, scheduledDate, durationMinutes, examId }),
  });
};

const sendDailySummaryEmail = ({ adminEmail, institutionName, date, stats }) => {
  const { dailySummaryEmail } = require('./emailTemplates');
  return sendEmail({
    to:      adminEmail,
    subject: `Daily Exam Summary — ${date}`,
    html:    dailySummaryEmail({ institutionName, date, stats }),
  });
};

const sendHighSeverityAlertEmail = ({ adminEmail, adminName, studentName, examTitle, violationType, severity, timestamp, message }) => {
  const { highSeverityAlertEmail } = require('./emailTemplates');
  return sendEmail({
    to:      adminEmail,
    subject: `🚨 High Severity Alert: ${examTitle}`,
    html:    highSeverityAlertEmail({ adminName, studentName, examTitle, violationType, severity, timestamp, message }),
  });
};

const sendStudentCredentialsEmail = ({ studentEmail, studentName, registrationNumber, examId, institutionName }) => {
  const { studentCredentialsEmail } = require('./emailTemplates');
  return sendEmail({
    to:      studentEmail,
    subject: `Your Exam Account — ${institutionName}`,
    html:    studentCredentialsEmail({ studentName, studentEmail, registrationNumber, examId, institutionName }),
  });
};

const sendExamEnrollmentEmail = ({ studentEmail, studentName, registrationNumber, examId, examTitle, scheduledDate, durationMinutes }) => {
  const { examEnrollmentEmail } = require('./emailTemplates');
  return sendEmail({
    to:      studentEmail,
    subject: `You've been enrolled: ${examTitle} (${examId})`,
    html:    examEnrollmentEmail({ studentName, studentEmail, registrationNumber, examId, examTitle, scheduledDate, durationMinutes }),
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendExamReminderEmail,
  sendDailySummaryEmail,
  sendHighSeverityAlertEmail,
  sendStudentCredentialsEmail,
  sendExamEnrollmentEmail,
};
