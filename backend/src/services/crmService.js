import store from '../utils/store.js';
import { generateAgentResponse } from './openaiService.js';

class CrmService {
  async scoreLead(leadId) {
    const lead = store.getLeads().find(l => l.id === leadId);
    if (!lead) return null;

    let score = 0;
    if (lead.email && lead.email.includes('@')) score += 10;
    if (lead.company) score += 15;
    if (lead.phone) score += 10;
    if (lead.source === 'ads') score += 20;
    if (lead.source === 'referral') score += 25;
    if (lead.interactions && lead.interactions.length > 0) score += lead.interactions.length * 5;
    if (lead.status === 'qualified') score += 30;
    if (lead.status === 'closed_won') score += 100;

    score = Math.min(100, score);
    store.updateLead(leadId, { score });
    return { leadId, score };
  }

  async autoQualify(leadId) {
    const lead = store.getLeads().find(l => l.id === leadId);
    if (!lead) return null;

    const result = await generateAgentResponse('customer-service', `Evaluate and qualify this lead: ${JSON.stringify({ firstName: lead.firstName, company: lead.company, source: lead.source, notes: lead.notes })}. Respond with a qualification score and recommended next action.`, {});

    return { leadId, qualification: result };
  }

  async autoRespond(leadId) {
    const lead = store.getLeads().find(l => l.id === leadId);
    if (!lead) return null;

    const result = await generateAgentResponse('customer-service', `Draft a professional, personalized first response to this lead: ${lead.firstName || 'there'} from ${lead.company || 'unknown company'}. Source: ${lead.source}. Make it warm, helpful, and include a soft CTA.`, {});

    return { leadId, response: result };
  }

  async getPipeline(ownerId) {
    const stages = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
    const leads = store.getLeads().filter(l => l.owner === ownerId);
    const pipeline = {};
    for (const stage of stages) {
      const stageLeads = leads.filter(l => l.status === stage);
      pipeline[stage] = {
        count: stageLeads.length,
        value: stageLeads.reduce((sum, l) => sum + (l.value || 0), 0),
      };
    }
    return pipeline;
  }

  async getAnalytics(ownerId, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const leads = store.getLeads().filter(l => l.owner === ownerId);
    const newLeads = leads.filter(l => new Date(l.createdAt) >= since).length;
    const converted = leads.filter(l => l.status === 'closed_won' && l.convertedAt && new Date(l.convertedAt) >= since);
    const totalValue = converted.reduce((sum, l) => sum + (l.value || 0), 0);

    return {
      newLeads,
      converted: converted.length,
      conversionRate: newLeads > 0 ? (converted.length / newLeads) * 100 : 0,
      totalValue,
      averageDealSize: converted.length > 0 ? totalValue / converted.length : 0,
    };
  }
}

export default new CrmService();
