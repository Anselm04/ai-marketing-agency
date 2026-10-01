import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@ai-marketing-agency.com';
const FROM_NAME = process.env.FROM_NAME || 'AI Marketing Agency';

let transporter = null;

/**
 * Fly secrets (pick one transport):
 *   RESEND_API_KEY (+ FROM_EMAIL verified in Resend)
 *   SENDGRID_API_KEY
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_SECURE
 *   AWS_SES_ACCESS_KEY / AWS_SES_SECRET_KEY (/ AWS_SES_HOST)
 * JWT_SECRET is required separately for auth tokens (never put secrets in git).
 */
function getTransporter() {
  if (transporter) return transporter;

  // Resend via SMTP (https://resend.com/docs/send-with-smtp)
  if (process.env.RESEND_API_KEY) {
    transporter = nodemailer.createTransport({
      host: process.env.RESEND_SMTP_HOST || 'smtp.resend.com',
      port: Number(process.env.RESEND_SMTP_PORT || 587),
      secure: false,
      auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
    });
    return transporter;
  }

  // SendGrid via SMTP
  if (process.env.SENDGRID_API_KEY) {
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY },
    });
    return transporter;
  }

  // AWS SES via SMTP
  if (process.env.AWS_SES_ACCESS_KEY && process.env.AWS_SES_SECRET_KEY) {
    transporter = nodemailer.createTransport({
      host: process.env.AWS_SES_HOST || 'email-smtp.us-east-1.amazonaws.com',
      port: 587,
      auth: { user: process.env.AWS_SES_ACCESS_KEY, pass: process.env.AWS_SES_SECRET_KEY },
    });
    return transporter;
  }

  // Generic SMTP
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    return transporter;
  }

  // Ethereal / test account for development only (never in production)
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: 'test@ethereal.email', pass: 'testpass' },
    });
    return transporter;
  }

  return null;
}

export function emailTransportConfigured() {
  return !!(
    process.env.RESEND_API_KEY
    || process.env.SENDGRID_API_KEY
    || (process.env.AWS_SES_ACCESS_KEY && process.env.AWS_SES_SECRET_KEY)
    || process.env.SMTP_HOST
  );
}

export async function sendEmail({ to, subject, html, text, from = FROM_EMAIL, fromName = FROM_NAME }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[Email no-transport] To: ${to}, Subject: ${subject}`);
    return { fallback: true, messageId: 'dev-' + Date.now(), reason: 'no_email_transport' };
  }

  try {
    const info = await t.sendMail({
      from: `"${fromName}" <${from}>`,
      to,
      subject,
      text,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { fallback: true, error: err.message };
  }
}

export async function sendPasswordReset(email, resetToken, resetUrl) {
  const link = `${resetUrl}${resetUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(resetToken)}`;
  return sendEmail({
    to: email,
    subject: 'Reset your password',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your AI Marketing Agency account.</p>
        <p><a href="${link}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
        <p>Or copy this link: ${link}</p>
        <p>This link expires in 1 hour.</p>
      </div>
    `,
    text: `Reset your password: ${link}\nThis link expires in 1 hour.`,
  });
}

export async function sendTeamInvite(email, orgName, inviteUrl, invitedBy) {
  return sendEmail({
    to: email,
    subject: `You've been invited to join ${orgName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Team Invitation</h2>
        <p>${invitedBy} has invited you to join <strong>${orgName}</strong> on AI Marketing Agency.</p>
        <p><a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Accept Invitation</a></p>
        <p>This invitation expires in 7 days.</p>
      </div>
    `,
    text: `You've been invited to join ${orgName}. Accept here: ${inviteUrl}`,
  });
}

export async function sendWelcomeEmail(email, firstName) {
  return sendEmail({
    to: email,
    subject: 'Welcome to AI Marketing Agency',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome, ${firstName || 'there'}!</h2>
        <p>Your AI-powered marketing agency is ready to go.</p>
        <p>Get started by:</p>
        <ul>
          <li>Creating your first campaign</li>
          <li>Connecting social media accounts</li>
          <li>Inviting your team</li>
        </ul>
      </div>
    `,
    text: `Welcome to AI Marketing Agency! Your account is ready.`,
  });
}

export async function sendCampaignReport(email, campaignName, stats) {
  return sendEmail({
    to: email,
    subject: `Campaign Report: ${campaignName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Campaign Report: ${campaignName}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Impressions</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${stats.impressions?.toLocaleString() || 0}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Clicks</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${stats.clicks?.toLocaleString() || 0}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Conversions</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${stats.conversions?.toLocaleString() || 0}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Revenue</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">$${stats.revenue?.toLocaleString() || 0}</td></tr>
        </table>
      </div>
    `,
    text: `Campaign Report: ${campaignName}\nImpressions: ${stats.impressions || 0}\nClicks: ${stats.clicks || 0}\nConversions: ${stats.conversions || 0}\nRevenue: $${stats.revenue || 0}`,
  });
}
