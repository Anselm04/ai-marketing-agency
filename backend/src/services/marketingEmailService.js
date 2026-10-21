import store from '../utils/store.js';
import { sendEmail, emailTransportConfigured } from './emailService.js';
import {
  createUnsubscribeToken,
  requireMarketingSendConsent,
} from './marketingEmailConsentService.js';

function publicAppUrl() {
  const url = process.env.APP_URL || process.env.FRONTEND_URL || null;
  if (!url && process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('Public application URL is required for marketing unsubscribe links.'), {
      status: 503,
      code: 'public_app_url_not_configured',
    });
  }
  return (url || 'http://localhost:3000').replace(/\/$/, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function appendUnsubscribeHtml(html, unsubscribeUrl) {
  return `${html || ''}\n<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0" />\n<p style="font-family:sans-serif;font-size:12px;color:#6b7280">You received this marketing email because consent is recorded for this contact. <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a>.</p>`;
}

function appendUnsubscribeText(text, unsubscribeUrl) {
  return `${text || ''}\n\nUnsubscribe: ${unsubscribeUrl}`.trim();
}

export async function sendMarketingEmailToLead({ ownerId, leadId, subject, html, text }) {
  if (!emailTransportConfigured() && process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('Marketing email transport is not configured.'), {
      status: 503,
      code: 'marketing_email_transport_not_configured',
    });
  }
  if (!subject || (!html && !text)) {
    throw Object.assign(new Error('Marketing email subject and content are required.'), {
      status: 400,
      code: 'marketing_email_content_required',
    });
  }

  const lead = await requireMarketingSendConsent(ownerId, leadId);
  const token = createUnsubscribeToken({ ownerId, leadId: lead.id, email: lead.email });
  const unsubscribeUrl = `${publicAppUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}`;

  const result = await sendEmail({
    to: lead.email,
    subject: String(subject).slice(0, 250),
    html: appendUnsubscribeHtml(html, unsubscribeUrl),
    text: appendUnsubscribeText(text || String(html || '').replace(/<[^>]+>/g, ' '), unsubscribeUrl),
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  if (!result?.success) {
    throw Object.assign(new Error('Marketing email provider did not confirm delivery acceptance.'), {
      status: 502,
      code: 'marketing_email_send_failed',
    });
  }

  await store.updateLead(lead.id, {
    lastMarketingEmailAt: new Date().toISOString(),
    lastMarketingEmailMessageId: result.messageId || null,
  });

  return {
    success: true,
    leadId: lead.id,
    messageId: result.messageId || null,
  };
}
