// Without provider idempotency guarantees, a timed-out write may already have
// succeeded. Only read operations may be automatically replayed or failed over.
export function isConnectorRead(operation) {
  return String(operation?.method || 'GET').toUpperCase() === 'GET';
}

export function isTransientConnectorFailure(error) {
  const status = error?.response?.status;
  if (status != null) return status >= 500 && status <= 599;
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(error?.code);
}

export function connectorRetryCount(operation) {
  if (!isConnectorRead(operation)) return 0;
  const retries = Number(operation.retries ?? 1);
  return Number.isInteger(retries) && retries >= 0 ? Math.min(retries, 3) : 0;
}
