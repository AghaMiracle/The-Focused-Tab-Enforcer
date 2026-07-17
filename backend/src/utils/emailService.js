/**
 * emailService.js
 * Transactional email via Brevo (@getbrevo/brevo v3.x).
 *
 * Correct pattern for v3.0.x:
 *   const api = new TransactionalEmailsApi()
 *   api.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY
 *   const email = new SendSmtpEmail()
 *   await api.sendTransacEmail(email)
 *
 * Required env vars:
 *   BREVO_API_KEY    — Brevo API key (app.brevo.com → Settings → API Keys)
 *   EMAIL_FROM       — verified sender address registered in Brevo
 *   EMAIL_FROM_NAME  — display name  (default: Focused Tab Enforcer)
 */

const { TransactionalEmailsApi, SendSmtpEmail } = require('@getbrevo/brevo');
const logger = require('./logger');

// ─── Lazy singleton API instance ──────────────────────────────────────────────
let _apiInstance = null;

function getApi() {
  if (_apiInstance) return _apiInstance;

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error(
      'BREVO_API_KEY is not set. Add it to your .env file.\n' +
      'Get your key at: https://app.brevo.com → Settings → API Keys'
    );
  }

  const api = new TransactionalEmailsApi();
  api.authentications['apiKey'].apiKey = apiKey;
  _apiInstance = api;
  return _apiInstance;
}

// ─── Core send ────────────────────────────────────────────────────────────────

/**
 * Send a transactional email via Brevo.
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 * @returns {Promise<object|null>}
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const api = getApi();

    const email = new SendSmtpEmail();
    email.sender = {
      name:  process.env.EMAIL_FROM_NAME || 'Focused Tab Enforcer',
      email: process.env.EMAIL_FROM,
    };
    email.to          = [{ email: to }];
    email.subject     = subject;
    email.htmlContent = html;
    email.textContent = text || html.replace(/<[^>]+>/g, '');

    const result = await api.sendTransacEmail(email);
    logger.info(`[Brevo] Sent to ${to} — messageId: ${result?.body?.messageId ?? 'n/a'}`);
    return result;
  } catch (err) {
    logger.error(`[Brevo] Failed to send to ${to}: ${err.message}`);
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
