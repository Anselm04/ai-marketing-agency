import { useEffect, useState } from 'react';
import api from '../services/api';
import { ArrowLeft, Mail, Plus, ShieldCheck, ShieldX, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const emptyLead = { name: '', email: '', company: '', status: 'new', consent: false, consentSource: '' };

export default function CRM() {
  const [leads, setLeads] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [emailLead, setEmailLead] = useState(null);
  const [emailDraft, setEmailDraft] = useState({ subject: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    const res = await api.get('/crm/leads');
    setLeads(res.data || []);
  };

  useEffect(() => {
    refresh().catch(() => setMessage('Unable to load CRM leads.'));
  }, []);

  const addLead = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const created = await api.post('/crm/leads', {
        name: leadForm.name.trim(),
        email: leadForm.email.trim(),
        company: leadForm.company.trim(),
        status: leadForm.status,
      });
      if (leadForm.consent) {
        if (!leadForm.consentSource.trim()) throw new Error('Record where the marketing consent came from.');
        await api.post(`/crm/leads/${created.data.id}/marketing-consent`, {
          source: leadForm.consentSource.trim(),
        });
      }
      setLeadForm(emptyLead);
      setShowAdd(false);
      await refresh();
      setMessage('Lead saved.');
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || 'Unable to save lead.');
    } finally {
      setBusy(false);
    }
  };

  const recordConsent = async (lead) => {
    const source = window.prompt('Where was explicit marketing-email consent obtained? (Example: website signup checkbox, signed form, customer request)');
    if (!source?.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/crm/leads/${lead.id}/marketing-consent`, { source: source.trim() });
      await refresh();
      setMessage('Marketing consent recorded.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Unable to record consent.');
    } finally {
      setBusy(false);
    }
  };

  const revokeConsent = async (lead) => {
    if (!window.confirm(`Suppress marketing email for ${lead.email}?`)) return;
    setBusy(true);
    setMessage('');
    try {
      await api.delete(`/crm/leads/${lead.id}/marketing-consent`, { data: { reason: 'owner_revoked' } });
      await refresh();
      setMessage('Marketing email suppressed for this lead.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Unable to suppress marketing email.');
    } finally {
      setBusy(false);
    }
  };

  const sendMarketingEmail = async (event) => {
    event.preventDefault();
    if (!emailLead) return;
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/crm/leads/${emailLead.id}/marketing-email`, {
        subject: emailDraft.subject,
        text: emailDraft.text,
      });
      setEmailLead(null);
      setEmailDraft({ subject: '', text: '' });
      await refresh();
      setMessage('Marketing email accepted by the configured email provider.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Marketing email was not sent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" aria-label="Back to dashboard">
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CRM</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Marketing email is blocked unless explicit consent is recorded and the contact is not suppressed.</p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={16} /> Add Lead
          </button>
        </div>

        {message && <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{message}</div>}

        {showAdd && (
          <form onSubmit={addLead} className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Add lead</h2>
              <button type="button" onClick={() => setShowAdd(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input required value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} placeholder="Name" className="rounded-lg border px-3 py-2 bg-transparent dark:text-white" />
              <input required type="email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} placeholder="Email" className="rounded-lg border px-3 py-2 bg-transparent dark:text-white" />
              <input value={leadForm.company} onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })} placeholder="Company" className="rounded-lg border px-3 py-2 bg-transparent dark:text-white" />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input type="checkbox" checked={leadForm.consent} onChange={(e) => setLeadForm({ ...leadForm, consent: e.target.checked })} className="mt-1" />
              <span>I have explicit permission from this person to send them marketing email.</span>
            </label>
            {leadForm.consent && (
              <input required value={leadForm.consentSource} onChange={(e) => setLeadForm({ ...leadForm, consentSource: e.target.value })} placeholder="Consent source (required)" className="w-full rounded-lg border px-3 py-2 bg-transparent dark:text-white" />
            )}
            <button disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">Save lead</button>
          </form>
        )}

        {emailLead && (
          <form onSubmit={sendMarketingEmail} className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Email {emailLead.name || emailLead.email}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">A signed unsubscribe link is automatically added. This sends to one consented lead only.</p>
              </div>
              <button type="button" onClick={() => setEmailLead(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <input required value={emailDraft.subject} onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })} placeholder="Subject" className="w-full rounded-lg border px-3 py-2 bg-transparent dark:text-white" />
            <textarea required rows={7} value={emailDraft.text} onChange={(e) => setEmailDraft({ ...emailDraft, text: e.target.value })} placeholder="Marketing message" className="w-full rounded-lg border px-3 py-2 bg-transparent dark:text-white" />
            <button disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">Send consented email</button>
          </form>
        )}

        {leads.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">No leads yet</div>
        ) : (
          <div className="grid gap-4">
            {leads.map(lead => {
              const emailStatus = lead.marketingEmailStatus || {};
              return (
                <div key={lead.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{lead.name || lead.email}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{lead.email} {lead.company ? `• ${lead.company}` : ''}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        {emailStatus.granted ? (
                          <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400"><ShieldCheck size={14} /> Marketing consent active</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"><ShieldX size={14} /> Marketing email blocked ({emailStatus.status || 'unknown'})</span>
                        )}
                        {emailStatus.source && <span className="text-gray-500">Source: {emailStatus.source}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Score: {lead.score || 0}</span>
                      {emailStatus.granted ? (
                        <>
                          <button disabled={busy} onClick={() => { setEmailLead(lead); setEmailDraft({ subject: '', text: '' }); }} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"><Mail size={14} /> Email</button>
                          <button disabled={busy} onClick={() => revokeConsent(lead)} className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm disabled:opacity-50">Suppress</button>
                        </>
                      ) : (
                        <button disabled={busy} onClick={() => recordConsent(lead)} className="px-3 py-2 rounded-lg border border-green-200 text-green-700 text-sm disabled:opacity-50">Record consent</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
