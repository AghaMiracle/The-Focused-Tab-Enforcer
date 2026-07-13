/**
 * emailTemplates.js
 * HTML email templates — Obsidian & Lime design system.
 * Matches the frontend UI: #0c0c0c bg, #ccff00 accent, #ebebeb text,
 * Space Grotesk headings, JetBrains Mono for data.
 *
 * All templates are inlined for maximum email-client compatibility.
 */

// ─── Google Fonts preconnect (best-effort; most clients ignore) ───────────────
const FONT_LINK = `
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
`;

// ─── Shared inline style blocks ───────────────────────────────────────────────
const BASE_STYLES = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0a0a0a;
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #ebebeb;
      -webkit-font-smoothing: antialiased;
      padding: 0;
      margin: 0;
    }
    .email-wrapper {
      background-color: #0a0a0a;
      padding: 40px 16px;
      min-height: 100vh;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background: #111111;
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
    }
    /* ── Header ── */
    .email-header {
      background: linear-gradient(135deg, #0c0c0c 0%, #141414 100%);
      padding: 32px 40px;
      border-bottom: 1px solid rgba(204,255,0,0.15);
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-logo {
      width: 44px; height: 44px;
      background: #ccff00;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 15px; font-weight: 700;
      color: #0c0c0c;
      letter-spacing: -0.5px;
      flex-shrink: 0;
    }
    .brand-text-wrap { display: inline-block; vertical-align: middle; }
    .brand-name {
      font-size: 16px; font-weight: 700;
      color: #ebebeb; line-height: 1;
      display: block;
    }
    .brand-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px; letter-spacing: 0.18em;
      color: rgba(235,235,235,0.4);
      text-transform: uppercase;
      display: block; margin-top: 3px;
    }
    .header-badge {
      margin-left: auto;
      background: rgba(204,255,0,0.08);
      border: 1px solid rgba(204,255,0,0.2);
      border-radius: 999px;
      padding: 4px 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .badge-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #ccff00;
      display: inline-block;
    }
    .badge-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px; letter-spacing: 0.15em;
      color: #ccff00; text-transform: uppercase;
    }
    /* ── Body ── */
    .email-body { padding: 40px; }
    .email-title {
      font-size: 26px; font-weight: 700;
      color: #ebebeb; letter-spacing: -0.03em;
      line-height: 1.2; margin-bottom: 10px;
    }
    .email-subtitle {
      font-size: 14px; color: rgba(235,235,235,0.55);
      line-height: 1.6; margin-bottom: 28px;
    }
    p { font-size: 14px; color: rgba(235,235,235,0.75); line-height: 1.7; margin-bottom: 14px; }
    /* ── Cards ── */
    .info-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; padding: 20px 24px;
      margin: 20px 0;
    }
    .info-row {
      display: flex; align-items: flex-start;
      gap: 12px; padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .info-row:last-child { border-bottom: none; padding-bottom: 0; }
    .info-row:first-child { padding-top: 0; }
    .info-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px; letter-spacing: 0.15em;
      color: rgba(235,235,235,0.35); text-transform: uppercase;
      min-width: 88px; padding-top: 2px; flex-shrink: 0;
    }
    .info-value {
      font-size: 13px; font-weight: 500;
      color: #ebebeb; word-break: break-word;
    }
    /* ── Alert card variants ── */
    .alert-card-high {
      background: rgba(255,68,68,0.06);
      border: 1px solid rgba(255,68,68,0.25);
      border-radius: 16px; padding: 20px 24px; margin: 20px 0;
    }
    .alert-badge-high {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(255,68,68,0.12);
      border: 1px solid rgba(255,68,68,0.3);
      border-radius: 999px; padding: 4px 12px; margin-bottom: 14px;
    }
    .alert-badge-high span { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.15em; color: #ff4444; text-transform: uppercase; }
    /* ── Steps list ── */
    .steps-list { list-style: none; padding: 0; margin: 0; }
    .steps-list li {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 13px; color: rgba(235,235,235,0.75);
    }
    .steps-list li:last-child { border-bottom: none; }
    .step-num {
      width: 22px; height: 22px;
      background: rgba(204,255,0,0.1);
      border: 1px solid rgba(204,255,0,0.25);
      border-radius: 6px; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; font-weight: 600; color: #ccff00;
    }
    /* ── Stats row ── */
    .stats-row {
      display: table; width: 100%;
      border-spacing: 10px; border-collapse: separate;
      margin: 20px 0;
    }
    .stat-cell {
      display: table-cell; text-align: center;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px; padding: 16px 12px;
      width: 25%;
    }
    .stat-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 26px; font-weight: 600;
      color: #ccff00; display: block; line-height: 1;
      margin-bottom: 6px;
    }
    .stat-value.danger { color: #ff4444; }
    .stat-label {
      font-size: 10px; color: rgba(235,235,235,0.4);
      text-transform: uppercase; letter-spacing: 0.08em;
    }
    /* ── CTA button ── */
    .btn-primary {
      display: inline-block;
      background: #ccff00; color: #0c0c0c !important;
      text-decoration: none;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 14px; font-weight: 700;
      padding: 14px 32px; border-radius: 999px;
      letter-spacing: -0.01em;
      box-shadow: 0 0 24px rgba(204,255,0,0.25);
    }
    .btn-wrap { text-align: center; margin: 28px 0; }
    /* ── Fallback URL ── */
    .fallback-url {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px; padding: 12px 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; color: rgba(235,235,235,0.4);
      word-break: break-all; margin-top: 10px;
    }
    .divider {
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 24px 0;
    }
    /* ── Footer ── */
    .email-footer {
      background: #0c0c0c;
      border-top: 1px solid rgba(255,255,255,0.06);
      padding: 24px 40px; text-align: center;
    }
    .footer-text {
      font-size: 11px; color: rgba(235,235,235,0.25); line-height: 1.6;
    }
    .footer-brand {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; color: rgba(204,255,0,0.4);
      letter-spacing: 0.15em; text-transform: uppercase;
      margin-bottom: 8px;
    }
  </style>
`;

// ─── Base layout ──────────────────────────────────────────────────────────────
const baseLayout = ({ content, badgeText = 'AUTOMATED', preheader = '' }) => `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Focused Tab Enforcer</title>
  ${FONT_LINK}
  ${BASE_STYLES}
</head>
<body>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ''}
  <div class="email-wrapper">
    <div class="email-container">

      <!-- Header -->
      <div class="email-header">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="44" valign="middle">
              <div class="brand-logo">FT</div>
            </td>
            <td width="12"></td>
            <td valign="middle">
              <span class="brand-name">Focused Tab Enforcer</span>
              <span class="brand-tag">Exam Monitoring Platform</span>
            </td>
            <td align="right" valign="middle">
              <div class="header-badge">
                <span class="badge-dot"></span>
                <span class="badge-text">${badgeText}</span>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Body -->
      <div class="email-body">
        ${content}
      </div>

      <!-- Footer -->
      <div class="email-footer">
        <p class="footer-brand">Focused Tab Enforcer</p>
        <p class="footer-text">
          This is an automated message. Please do not reply to this email.<br />
          &copy; ${new Date().getFullYear()} Focused Tab Enforcer. All rights reserved.
        </p>
      </div>

    </div>
  </div>
</body>
</html>
`;

// ─── Template helpers ─────────────────────────────────────────────────────────
const infoRow = (label, value) => `
  <div class="info-row">
    <span class="info-label">${label}</span>
    <span class="info-value">${value}</span>
  </div>`;

const stepItem = (num, text) => `
  <li>
    <span class="step-num">${num}</span>
    <span>${text}</span>
  </li>`;

// ─── 1. Welcome Email ─────────────────────────────────────────────────────────
const welcomeEmail = ({ institutionName }) =>
  baseLayout({
    badgeText: 'WELCOME',
    preheader: `Welcome to Focused Tab Enforcer, ${institutionName}! Your account is ready.`,
    content: `
      <h1 class="email-title">Welcome aboard,<br /><span style="color:#ccff00">${institutionName}</span></h1>
      <p class="email-subtitle">Your institution has been successfully registered. You're ready to run AI-monitored exams.</p>

      <div class="info-card">
        <p style="font-size:12px;color:rgba(235,235,235,0.4);margin-bottom:12px;font-family:'JetBrains Mono',monospace;letter-spacing:0.1em;text-transform:uppercase;">Getting Started</p>
        <ul class="steps-list">
          ${stepItem(1, 'Log in to your <strong style="color:#ebebeb">dashboard</strong>')}
          ${stepItem(2, 'Add your students via CSV or manual entry')}
          ${stepItem(3, 'Create and schedule your first exam')}
          ${stepItem(4, 'Distribute the <strong style="color:#ebebeb">browser extension</strong> to students')}
          ${stepItem(5, 'Go live — monitor in real time')}
        </ul>
      </div>

      <div class="divider"></div>

      <p style="font-size:13px;color:rgba(235,235,235,0.5);">
        Questions? Reach out to our support team anytime.
        We're here to help you get set up quickly.
      </p>
    `,
  });

// ─── 2. Password Reset Email ──────────────────────────────────────────────────
const passwordResetEmail = ({ resetUrl, expiresIn = '1 hour' }) =>
  baseLayout({
    badgeText: 'SECURITY',
    preheader: 'Reset your Focused Tab Enforcer password. Link expires in 1 hour.',
    content: `
      <h1 class="email-title">Password<br /><span style="color:#ccff00">Reset Request</span></h1>
      <p class="email-subtitle">We received a request to reset your password. Click the button below to set a new one.</p>

      <div class="btn-wrap">
        <a href="${resetUrl}" class="btn-primary">Reset My Password</a>
      </div>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Expires</span>
          <span class="info-value">${expiresIn} from when this email was sent</span>
        </div>
        <div class="info-row">
          <span class="info-label">Not you?</span>
          <span class="info-value" style="color:rgba(235,235,235,0.5)">Ignore this email — your password will not change.</span>
        </div>
      </div>

      <p style="font-size:12px;color:rgba(235,235,235,0.4);margin-top:20px;">
        If the button above doesn't work, copy and paste this link into your browser:
      </p>
      <div class="fallback-url">${resetUrl}</div>
    `,
  });

// ─── 3. Exam Reminder Email ───────────────────────────────────────────────────
const examReminderEmail = ({ studentName, examTitle, scheduledDate, durationMinutes, examId }) => {
  const dateStr = new Date(scheduledDate).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return baseLayout({
    badgeText: 'REMINDER',
    preheader: `Exam reminder: ${examTitle} is scheduled for ${dateStr}.`,
    content: `
      <h1 class="email-title">Exam<br /><span style="color:#ccff00">Reminder</span></h1>
      <p class="email-subtitle">Hello <strong style="color:#ebebeb">${studentName}</strong> — your exam is coming up soon. Make sure you're prepared.</p>

      <div class="info-card">
        ${infoRow('Exam', `<strong style="color:#ccff00">${examTitle}</strong>`)}
        ${infoRow('Exam ID', `<span style="font-family:'JetBrains Mono',monospace;font-size:12px">${examId}</span>`)}
        ${infoRow('Date &amp; Time', dateStr)}
        ${infoRow('Duration', `${durationMinutes} minutes`)}
      </div>

      <div class="info-card" style="background:rgba(204,255,0,0.04);border-color:rgba(204,255,0,0.15);">
        <p style="font-size:12px;color:rgba(235,235,235,0.4);margin-bottom:12px;font-family:'JetBrains Mono',monospace;letter-spacing:0.1em;text-transform:uppercase;">Pre-Exam Checklist</p>
        <ul class="steps-list">
          ${stepItem('✓', 'Install the <strong style="color:#ebebeb">Focused Tab Enforcer</strong> Chrome extension')}
          ${stepItem('✓', 'Test your webcam and ensure camera access is allowed')}
          ${stepItem('✓', 'Use a stable internet connection')}
          ${stepItem('✓', 'Close all unnecessary tabs and applications')}
          ${stepItem('✓', 'Have your Registration Number and Exam ID ready')}
        </ul>
      </div>

      <p style="font-size:12px;color:rgba(235,235,235,0.4);">
        Tab switching, window blur, and face absence are automatically logged as violations. Stay focused.
      </p>
    `,
  });
};

// ─── 4. Daily Summary Email ───────────────────────────────────────────────────
const dailySummaryEmail = ({ institutionName, date, stats }) =>
  baseLayout({
    badgeText: 'REPORT',
    preheader: `Daily exam summary for ${institutionName} — ${date}.`,
    content: `
      <h1 class="email-title">Daily Activity<br /><span style="color:#ccff00">Summary</span></h1>
      <p class="email-subtitle">
        Here's what happened at <strong style="color:#ebebeb">${institutionName}</strong> on <strong style="color:#ebebeb">${date}</strong>.
      </p>

      <!-- Stats — using table layout for email client compat -->
      <table width="100%" cellpadding="0" cellspacing="8" border="0" style="margin:20px 0;">
        <tr>
          <td width="25%" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 12px;text-align:center;">
            <span class="stat-value">${stats.totalExams}</span>
            <span class="stat-label">Exams</span>
          </td>
          <td width="4"></td>
          <td width="25%" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 12px;text-align:center;">
            <span class="stat-value">${stats.totalStudents}</span>
            <span class="stat-label">Students</span>
          </td>
          <td width="4"></td>
          <td width="25%" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 12px;text-align:center;">
            <span class="stat-value">${stats.totalViolations}</span>
            <span class="stat-label">Violations</span>
          </td>
          <td width="4"></td>
          <td width="25%" style="background:rgba(255,68,68,0.06);border:1px solid rgba(255,68,68,0.2);border-radius:14px;padding:16px 12px;text-align:center;">
            <span class="stat-value danger">${stats.highSeverityViolations}</span>
            <span class="stat-label">High Severity</span>
          </td>
        </tr>
      </table>

      <div class="divider"></div>
      <p style="font-size:13px;color:rgba(235,235,235,0.5);">
        Log in to your dashboard to view full violation timelines, student reports, and session recordings.
      </p>
    `,
  });

// ─── 5. High Severity Alert Email ────────────────────────────────────────────
const highSeverityAlertEmail = ({
  adminName, studentName, examTitle,
  violationType, severity, timestamp, message,
}) => {
  const timeStr = new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const typeLabel = (violationType || '').replace(/_/g, ' ').toUpperCase();

  return baseLayout({
    badgeText: 'ALERT',
    preheader: `High severity violation detected — ${typeLabel} during ${examTitle}.`,
    content: `
      <h1 class="email-title">Violation<br /><span style="color:#ff4444">Alert</span></h1>
      <p class="email-subtitle">
        Hello <strong style="color:#ebebeb">${adminName}</strong> — a high-severity violation was detected
        during an active exam session. Immediate review may be required.
      </p>

      <div class="alert-card-high">
        <div class="alert-badge-high">
          <span>⚠</span>
          <span>${severity.toUpperCase()} SEVERITY</span>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${[
            ['Student',    studentName],
            ['Exam',       `<strong style="color:#ebebeb">${examTitle}</strong>`],
            ['Violation',  `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#ff4444">${typeLabel}</span>`],
            ['Severity',   `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#ff4444">${severity.toUpperCase()}</span>`],
            ['Detected',   `<span style="font-family:'JetBrains Mono',monospace;font-size:11px">${timeStr}</span>`],
            ['Details',    message],
          ].map(([label, value]) => `
            <tr>
              <td style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.15em;color:rgba(235,235,235,0.35);text-transform:uppercase;padding:6px 0;vertical-align:top;min-width:80px;width:80px">${label}</td>
              <td style="width:12px"></td>
              <td style="font-size:13px;font-weight:500;color:#ebebeb;padding:6px 0">${value}</td>
            </tr>
            <tr><td colspan="3" style="height:1px;background:rgba(255,255,255,0.05)"></td></tr>
          `).join('')}
        </table>
      </div>

      <div class="divider"></div>
      <p style="font-size:13px;color:rgba(235,235,235,0.5);">
        Log in to your dashboard to review the full session timeline and take appropriate action.
      </p>
    `,
  });
};

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  welcomeEmail,
  passwordResetEmail,
  examReminderEmail,
  dailySummaryEmail,
  highSeverityAlertEmail,
};
