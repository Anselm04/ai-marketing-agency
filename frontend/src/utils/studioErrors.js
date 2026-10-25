export const generationUnavailable = () => ({
  message: 'The AI service is unavailable right now. Your input is unchanged. Please try again later or contact support.',
  billing: false,
});

export function studioError(error) {
  const status = error?.response?.status;
  const code = error?.response?.data?.code;
  if (code === 'plan_quota_exceeded') return {
    message: 'You have reached your plan’s AI usage limit. Review your allowance in Billing before trying again.', billing: true,
  };
  if (status === 402) return {
    message: 'Your plan does not allow this request. Review your subscription in Billing.', billing: true,
  };
  if (status === 429) return { message: 'The service is busy or rate limited. Wait a moment, then try again.', billing: false };
  if (status === 403) return { message: 'Your account does not have access to this action. Contact support if you need help.', billing: false };
  if (status === 401) return { message: 'Your session has expired. Sign in again to continue.', billing: false };
  if (status === 400 || status === 422) return { message: 'Check your text and required fields, then try again.', billing: false };
  if (!status) return { message: 'Could not reach the service. Check your connection and try again.', billing: false };
  return generationUnavailable();
}

export function hasGeneratedText(result, field) {
  return result?.fallback !== true && typeof result?.[field] === 'string' && Boolean(result[field].trim());
}
