import { generateAgentResponse } from './openaiService.js';

function executionError(message, status, code, details = undefined) {
  return Object.assign(new Error(message), { status, code, ...(details ? { details } : {}) });
}

export async function executeAgentTask({
  agent,
  task,
  userId,
  context = {},
  generate = generateAgentResponse,
}) {
  const normalizedTask = String(task || '').trim();
  if (!normalizedTask) {
    throw executionError('A task is required to execute an AI agent.', 400, 'agent_task_required');
  }

  const agentId = agent?.agentId || agent?.id;
  if (!agentId) {
    throw executionError('The selected AI agent is invalid.', 400, 'invalid_agent');
  }

  const generated = await generate(agentId, normalizedTask, {
    ...context,
    userId,
    agentName: agent?.name,
    agentRole: agent?.role,
    agentCategory: agent?.category,
  });

  if (!generated || generated.fallback === true) {
    throw executionError(
      'The AI provider could not execute this agent task.',
      503,
      'ai_provider_unavailable',
      {
        providerError: generated?.error || null,
        missingKey: generated?.missingKey || null,
      },
    );
  }

  const content = String(generated.content || '').trim();
  if (!content) {
    throw executionError('The AI provider returned an empty agent result.', 502, 'empty_agent_result');
  }

  return {
    success: true,
    agentId,
    task: normalizedTask,
    result: content,
    usage: generated.tokens || null,
  };
}

export default executeAgentTask;
