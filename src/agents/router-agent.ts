/**
 * Router Agent - The orchestrator that analyzes tasks and delegates to specialists.
 *
 * This agent acts as the "manager" in the swarm, analyzing user requests,
 * determining which specialist agents to involve, and synthesizing final results.
 */

import { BaseAgent } from './base-agent.js';

/**
 * Delegation instruction.
 */
interface Delegation {
    agent: string;
    task: string;
}

/**
 * Router agent responsible for task analysis and delegation.
 */
export class RouterAgent extends BaseAgent {
    constructor() {
        const systemPrompt = `You are the Router Agent, the coordinator of a multi-agent system.

Your responsibilities:
1. Analyze user tasks and determine which specialist agents to involve
2. Break down complex tasks into subtasks for different specialists
3. Coordinate the workflow between agents
4. Synthesize final results from multiple specialists

Available specialist agents:
- coder: Writes and refactors code, creates files, implements features
- reviewer: Reviews code quality, checks for security issues, analyzes logs
- researcher: Gathers information, performs web searches, analyzes data

When analyzing a task, respond with a delegation plan in this format:
DELEGATION:
- agent: <agent_name>
- task: <specific task for that agent>

You may delegate to multiple agents in sequence or parallel.`;

        super('router', systemPrompt);
    }

    /**
     * Analyze a user task and create a delegation plan.
     */
    async analyzeAndDelegate(userTask: string): Promise<Delegation[]> {
        const analysis = await this.execute(userTask);

        // Parse the delegation plan from the response
        const delegations: Delegation[] = [];
        const lines = analysis.split('\n');
        let currentDelegation: Partial<Delegation> = {};

        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('- agent:')) {
                if (currentDelegation.agent && currentDelegation.task) {
                    delegations.push(currentDelegation as Delegation);
                }
                currentDelegation = { agent: line.split(':', 2)[1].trim() };
            } else if (line.startsWith('- task:') && currentDelegation.agent) {
                currentDelegation.task = line.split(':', 2)[1].trim();
            }
        }

        if (currentDelegation.agent && currentDelegation.task) {
            delegations.push(currentDelegation as Delegation);
        }

        // Fallback: if no delegations parsed, use simple keyword matching
        if (delegations.length === 0) {
            return this.simpleDelegate(userTask);
        }

        return delegations;
    }

    /**
     * Simple keyword-based delegation as fallback.
     */
    private simpleDelegate(task: string): Delegation[] {
        const taskLower = task.toLowerCase();
        const delegations: Delegation[] = [];

        // Check for code-related keywords
        if (
            ['code', 'implement', 'build', 'create', 'write', 'function'].some((word) =>
                taskLower.includes(word)
            )
        ) {
            delegations.push({ agent: 'coder', task });
        }

        // Check for review-related keywords
        if (
            ['review', 'check', 'security', 'quality', 'analyze'].some((word) =>
                taskLower.includes(word)
            )
        ) {
            delegations.push({ agent: 'reviewer', task });
        }

        // Check for research-related keywords
        if (
            ['research', 'search', 'find', 'information', 'learn'].some((word) =>
                taskLower.includes(word)
            )
        ) {
            delegations.push({ agent: 'researcher', task });
        }

        // Default to coder if no matches
        if (delegations.length === 0) {
            delegations.push({ agent: 'coder', task });
        }

        return delegations;
    }

    /**
     * Synthesize final response from multiple agent results.
     */
    async synthesizeResults(delegations: Delegation[], results: string[]): Promise<string> {
        let synthesisPrompt = `Synthesize a final response based on the following agent outputs:\n\n`;

        delegations.forEach((delegation, i) => {
            synthesisPrompt += `${i + 1}. [${delegation.agent}] ${delegation.task}\n`;
            synthesisPrompt += `   Result: ${results[i] || 'No result'}\n\n`;
        });

        synthesisPrompt += 'Provide a concise final report summarizing what was accomplished.';

        return this.execute(synthesisPrompt);
    }
}
