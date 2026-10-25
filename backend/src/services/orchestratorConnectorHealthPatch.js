import { getConnectorById } from './connectors/index.js';
import { connectorHealthAllowsExecution } from './connectorUserHealthService.js';
import { intelligentOrchestrator } from './intelligentOrchestrator.js';

export function installOrchestratorConnectorHealthPatch(service = intelligentOrchestrator) {
  if (!service || service.__connectorHealthPatchApplied) return service;

  const originalSelect = service.selectConnectors.bind(service);

  service.selectConnectors = async function selectTenantHealthyConnectors(userId, taskType, requiredOperations = []) {
    const result = await originalSelect(userId, taskType, requiredOperations);
    if (!Array.isArray(requiredOperations) || requiredOperations.length === 0) return result;

    const profile = await service.getUserProfile(userId);
    const connected = profile?.connectedConnectors || [];
    const selectedIds = new Set((result.selected || []).map((item) => item.id));
    const supplemented = [...(result.selected || [])];

    for (const connection of connected) {
      if (selectedIds.has(connection.id) || !connectorHealthAllowsExecution(connection.health)) continue;
      const connector = getConnectorById(connection.id);
      if (!connector) continue;
      const supportedOperations = requiredOperations.filter((operation) =>
        connector.operations?.some((candidate) => candidate.id === operation));
      if (supportedOperations.length === 0) continue;

      supplemented.push({
        id: connector.id,
        name: connector.name,
        category: connector.category,
        health: connection.health.status,
        supportedOperations,
        score: connection.health.status === 'up' ? 0.75 : 0.6,
        healthDetail: connection.health.detail || null,
      });
      selectedIds.add(connector.id);
    }

    supplemented.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    return {
      ...result,
      selected: supplemented,
      connectedCount: connected.length,
    };
  };

  Object.defineProperty(service, '__connectorHealthPatchApplied', {
    value: true,
    enumerable: false,
  });
  return service;
}

export default installOrchestratorConnectorHealthPatch;