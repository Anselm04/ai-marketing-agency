import { describe, expect, test } from '@jest/globals';
import { publicFailure, sanitizeExecutionErrors } from '../orchestrator.js';

describe('orchestrator customer error boundary', () => {
  test('does not expose arbitrary provider error messages', () => {
    const failure = publicFailure(
      new Error('sk-live-secret provider rejected internal tenant 991'),
      'The AI request could not be completed.',
      'ai_execution_failed',
      503,
    );

    expect(failure).toEqual({
      status: 503,
      body: {
        error: 'The AI request could not be completed.',
        code: 'ai_execution_failed',
      },
    });
    expect(JSON.stringify(failure)).not.toContain('sk-live-secret');
  });

  test('maps allowlisted operational codes to safe customer messages', () => {
    const error = new Error('provider said account 1234 missing token abc');
    error.code = 'connector_customer_auth_required';
    error.statusCode = 401;

    expect(publicFailure(error, 'failed', 'fallback')).toEqual({
      status: 401,
      body: {
        error: 'Reconnect the required integration for this account before trying again.',
        code: 'connector_customer_auth_required',
      },
    });
  });

  test('sanitizes campaign operation failures while preserving retry facts', () => {
    const errors = sanitizeExecutionErrors([{
      type: 'connector',
      operation: 'publish',
      error: 'token=private-provider-token',
      retryQueued: false,
      backgroundRetryAvailable: false,
    }]);

    expect(errors).toEqual([{
      type: 'connector',
      operation: 'publish',
      code: 'orchestration_operation_failed',
      error: 'An orchestration operation could not be completed.',
      retryQueued: false,
      backgroundRetryAvailable: false,
    }]);
    expect(JSON.stringify(errors)).not.toContain('private-provider-token');
  });
});
