import { generateAgentResponse, generateCampaignStrategy } from './openaiService.js';

class AgentOrchestrator {
  constructor() {
    this.tasks = [];
    this.agentStatus = new Map();
    this.history = [];
    this.maxHistory = 1000;
    this.maxTasks = 500;
  }

  _trimArrays() {
    if (this.tasks.length > this.maxTasks) {
      this.tasks = this.tasks.slice(-this.maxTasks);
    }
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
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
    this._trimArrays();
    this.agentStatus.set(agentId, 'active');

    const result = await generateAgentResponse(agentId, task, context);

    taskRecord.status = 'completed';
    taskRecord.completedAt = new Date().toISOString();
    taskRecord.result = result;

    this.agentStatus.set(agentId, 'idle');
    this.history.push(taskRecord);
    this._trimArrays();

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
