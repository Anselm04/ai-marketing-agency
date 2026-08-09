import { generateAgentResponse, generateCampaignStrategy } from './openaiService.js';

class AgentOrchestrator {
  constructor() {
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

    const result = await generateAgentResponse(agentId, task, context);

    taskRecord.status = 'completed';
    taskRecord.completedAt = new Date().toISOString();
    taskRecord.result = result;

    this.agentStatus.set(agentId, 'idle');
    this.history.push(taskRecord);

    return taskRecord;
  }

  async runCampaignStrategy(product, budget, platforms, targetAudience) {
    return generateCampaignStrategy(product, budget, platforms, targetAudience);
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
