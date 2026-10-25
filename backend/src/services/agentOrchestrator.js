import { generateAgentResponse, generateCampaignStrategy } from './openaiService.js';

function agentExecutionError(message, code = 'scheduled_agent_execution_failed', statusCode = 503) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

class AgentOrchestrator {
  constructor() {
    // Runtime-only observability. Durable scheduled-job state is owned by
    // schedulerService/store; these collections are not presented as a durable ledger.
    this.tasks = [];
    this.agentStatus = new Map();
    this.history = [];
  }

  async executeTask(agentId, task, context = {}) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const taskRecord = {
      id: taskId,
      agentId,
      task,
      status: 'running',
      createdAt: new Date().toISOString(),
      completedAt: null,
      result: null,
    };

    this.tasks.push(taskRecord);
    this.agentStatus.set(agentId, 'active');

    try {
      const result = await generateAgentResponse(agentId, task, context);
      if (result?.fallback === true) {
        throw agentExecutionError('The AI provider did not execute the scheduled agent task. No fallback output was accepted as completion.');
      }
      if (!String(result?.content || '').trim()) {
        throw agentExecutionError('The scheduled agent task returned no usable output.');
      }

      taskRecord.status = 'completed';
      taskRecord.completedAt = new Date().toISOString();
      taskRecord.result = result;
      this.history.push(taskRecord);
      return taskRecord;
    } catch (error) {
      taskRecord.status = 'failed';
      taskRecord.completedAt = new Date().toISOString();
      taskRecord.error = error.message;
      this.history.push(taskRecord);
      throw error;
    } finally {
      this.agentStatus.set(agentId, 'idle');
    }
  }

  async runCampaignStrategy(product, budget, platforms, targetAudience) {
    const result = await generateCampaignStrategy(product, budget, platforms, targetAudience);
    if (result?.fallback === true) {
      throw agentExecutionError('Campaign strategy generation was not completed by the AI provider.');
    }
    return result;
  }

  getAgentStatus(agentId) {
    return this.agentStatus.get(agentId) || 'idle';
  }

  getRecentTasks(limit = 20) {
    return this.history.slice(-limit).reverse();
  }

  getAllTasks() {
    return this.tasks;
  }
}

export default new AgentOrchestrator();