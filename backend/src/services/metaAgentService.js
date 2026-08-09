import { generateAgentResponse } from './aiService.js';
import store from '../utils/store.js';

class MetaAgentService {
  async overseerReview() {
    const agents = store.getAgents();
    const tasks = store.getTasks().filter(t => t.status === 'running' || t.status === 'failed').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);

    const report = await generateAgentResponse('agent-oversight', `Review the following agents and tasks. Flag any underperformance, errors, or alignment issues. Suggest retraining or corrective actions.\n\nAgents: ${JSON.stringify(agents.map(a => ({ id: a.agentId, name: a.name, status: a.status, metrics: a.metrics })))}\n\nRecent Tasks: ${JSON.stringify(tasks.map(t => ({ id: t.taskId, agentId: t.agentId, status: t.status, task: t.task })))}`, {});

    return {
      review: report,
      flaggedAgents: agents.filter(a => a.status === 'error' || (a.metrics && a.metrics.successRate < 0.8)).map(a => a.agentId),
      flaggedTasks: tasks.filter(t => t.status === 'failed').map(t => t.taskId),
      timestamp: new Date().toISOString(),
    };
  }

  async coordinatorOptimize() {
    const agents = store.getAgents();
    const tasks = store.getTasks().filter(t => t.status === 'pending').sort((a, b) => (b.priority || 0) - (a.priority || 0) || new Date(a.createdAt) - new Date(b.createdAt)).slice(0, 50);

    const report = await generateAgentResponse('harmony-director', `Optimize the workflow for these pending tasks across agents. Identify conflicts, overlaps, and inefficiencies. Propose a reordered execution plan.\n\nAgents: ${JSON.stringify(agents.map(a => ({ id: a.agentId, name: a.name, category: a.category, status: a.status })))}\n\nPending Tasks: ${JSON.stringify(tasks.map(t => ({ id: t.taskId, agentId: t.agentId, priority: t.priority, task: t.task })))}`, {});

    return {
      optimization: report,
      suggestedOrder: tasks.map(t => t.taskId),
      conflicts: [],
      timestamp: new Date().toISOString(),
    };
  }

  async agentHealthCheck() {
    const agents = store.getAgents();
    const health = await Promise.all(agents.map(async (agent) => {
      const tasks = store.getTasks().filter(t => t.agentId === agent.agentId);
      const lastTask = tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      const stale = lastTask ? Date.now() - new Date(lastTask.createdAt).getTime() > 24 * 60 * 60 * 1000 : true;
      return {
        agentId: agent.agentId,
        name: agent.name,
        status: agent.status,
        healthy: agent.status === 'active' && !stale,
        stale,
        lastTaskAt: lastTask?.createdAt || null,
      };
    }));

    return health;
  }

  async retrainAgent(agentId, feedback) {
    const agent = store.getAgents().find(a => a.agentId === agentId);
    if (!agent) return null;

    const result = await generateAgentResponse('ai-trainer', `Retrain and improve the following agent based on feedback. Agent: ${agent.name}. Role: ${agent.role}. Feedback: ${feedback}. Provide updated system instructions and training notes.`, {});

    return {
      agentId,
      training: result,
      previousConfig: agent.config,
      timestamp: new Date().toISOString(),
    };
  }
}

export default new MetaAgentService();
