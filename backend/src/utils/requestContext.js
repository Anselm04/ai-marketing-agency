import { AsyncLocalStorage } from 'node:async_hooks';

const requestStorage = new AsyncLocalStorage();

export function runWithRequestContext(context, next) {
  return requestStorage.run(context || {}, next);
}

export function getRequestContext() {
  return requestStorage.getStore() || {};
}

export function getCurrentUserId() {
  return getRequestContext().userId || null;
}
