import { getConnectorById } from './connectors/index.js';
import { connectorHealthAllowsExecution } from './connectorUserHealthService.js';
import { executeCustomerConnectorRequest } from './safeConnectorExecutionService.js';
import { isConnectorRead, isTransientConnectorFailure } from './connectorRetryPolicy.js';
import { intelligentOrchestrator } from './intelligentOrchestrator.js';
import { logger } from '../utils/logger.js';

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

  service.executeConnectorTask = async function executeTenantSafeConnectorTask(userId, taskType, operation, payload = {}) {
    const connectors = await service.selectConnectors(userId, taskType, [operation]);
    if (!connectors.selected?.length) {
      const error = new Error(`No connected ${taskType} connectors available for operation: ${operation}. Connect a compatible integration first.`);
      error.statusCode = 400;
      error.code = 'CONNECTOR_MISSING';
      throw error;
    }

    let lastError = null;
    for (const selected of connectors.selected) {
      const connector = getConnectorById(selected.id);
      const operationInfo = connector?.operations?.find((candidate) => candidate.id === operation);
      if (!connector || !operationInfo) continue;
      if (lastError && !isConnectorRead(operationInfo)) continue;

      try {
        const result = await executeCustomerConnectorRequest({
          userId,
          connectorId: connector.id,
          definition: connector,
          operation,
          payload,
          allowServerCredential: false,
        });
        await service.logTaskHistory(userId, `${taskType}:${operation}`, {
          connectorId: connector.id,
          status: 'success',
        }).catch((error) => logger.warn('Could not record connector task history', { error: error.message }));
        return {
          ...result,
          orchestration: {
            selectedConnector: connector.id,
            connectorName: connector.name,
            health: selected.health,
            backgroundRetryAvailable: false,
          },
        };
      } catch (error) {
        lastError = error;
        await service.logTaskHistory(userId, `${taskType}:${operation}`, {
          connectorId: connector.id,
          status: 'error',
          error: error.message,
        }).catch(() => {});
        logger.error(`Tenant-safe connector task failed for user ${userId}: ${connector.id}/${operation}`, { error: error.message });
        if (!isConnectorRead(operationInfo) || !isTransientConnectorFailure(error)) break;
      }
    }

    if (!lastError) {
      lastError = new Error(`No compatible connected connector could execute operation: ${operation}`);
      lastError.statusCode = 400;
      lastError.code = 'CONNECTOR_OPERATION_UNAVAILABLE';
    }
    lastError.retryQueued = false;
    lastError.backgroundRetryAvailable = false;
    throw lastError;
  };

  Object.defineProperty(service, '__connectorHealthPatchApplied', {
    value: true,
    enumerable: false,
  });
  return service;
}

export default installOrchestratorConnectorHealthPatch;