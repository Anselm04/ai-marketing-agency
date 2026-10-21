import { describe, expect, jest, test } from '@jest/globals';
import { executeAgentTask } from '../services/agentExecutionService.js';

const agent = {
  id: 'agent-1',
  agentId: 'content',
  name: 'Content Agent',
  role: 'Writes campaign content',
  category: 'creative',
};

describe('agent execution service', () => {
  test('executes an accessible agent through the metered AI generator', async () => {
    const generate = jest.fn().mockResolvedValue({
      fallback: false,
      content: 'Three campaign concepts',
      tokens: { prompt_tokens: 40, completion_tokens: 60, total_tokens: 100 },
    });

    const result = await executeAgentTask({
      agent,
      task: 'Create three campaign concepts',
      userId: 'user-123',
      generate,
    });

    expect(generate).toHaveBeenCalledWith('content', 'Create three campaign concepts', expect.objectContaining({
      userId: 'user-123',
      agentName: 'Content Agent',
      agentRole: 'Writes campaign content',
      agentCategory: 'creative',
    }));
    expect(result).toEqual(expect.objectContaining({
      success: true,
      agentId: 'content',
      task: 'Create three campaign concepts',
      result: 'Three campaign concepts',
    }));
    expect(result.usage).toEqual(expect.objectContaining({ total_tokens: 100 }));
  });

  test('rejects an empty task before calling the AI provider', async () => {
    const generate = jest.fn();

    await expect(executeAgentTask({ agent, task: '   ', userId: 'user-123', generate }))
      .rejects.toMatchObject({ status: 400, code: 'agent_task_required' });
    expect(generate).not.toHaveBeenCalled();
  });

  test('fails visibly when the AI provider returns a fallback', async () => {
    const generate = jest.fn().mockResolvedValue({
      fallback: true,
      error: 'provider unavailable',
      missingKey: 'OPENAI_API_KEY or GROQ_API_KEY',
      content: '[AI offline] content would: create campaign',
    });

    await expect(executeAgentTask({ agent, task: 'Create campaign', userId: 'user-123', generate }))
      .rejects.toMatchObject({ status: 503, code: 'ai_provider_unavailable' });
  });
});
