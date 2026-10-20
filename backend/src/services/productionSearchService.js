function matches(value, query) {
  return String(value || '').toLowerCase().includes(query);
}

export async function searchOwnedEntities({ adapter, ownerId, query, type }) {
  const normalized = String(query || '').trim().toLowerCase();
  if (normalized.length < 2) return [];

  const results = [];

  if (!type || type === 'campaigns') {
    const campaigns = await adapter.getCampaignsByOwner(ownerId);
    results.push(...campaigns
      .filter((campaign) => matches(campaign.name, normalized) || matches(campaign.description, normalized))
      .map((campaign) => ({ ...campaign, entityType: 'campaign' })));
  }

  if (!type || type === 'content') {
    const content = await adapter.getContentByOwner(ownerId);
    results.push(...content
      .filter((item) => matches(item.title, normalized) || matches(item.body, normalized))
      .map((item) => ({ ...item, entityType: 'content' })));
  }

  if (!type || type === 'leads') {
    const leads = await adapter.getLeadsByOwner(ownerId);
    results.push(...leads
      .filter((lead) =>
        matches(lead.firstName, normalized)
        || matches(lead.lastName, normalized)
        || matches(lead.email, normalized)
        || matches(lead.company, normalized))
      .map((lead) => ({ ...lead, entityType: 'lead' })));
  }

  if (!type || type === 'agents') {
    const agents = await adapter.getAgents();
    results.push(...agents
      .filter((agent) => matches(agent.name, normalized) || matches(agent.role, normalized))
      .map((agent) => ({ ...agent, entityType: 'agent' })));
  }

  return results.slice(0, 50);
}
