/**
 * Multi-Agent Swarm Orchestration System.
 *
 * Implements a lightweight Router-Worker pattern for coordinating multiple
 * specialist agents to solve complex tasks collaboratively.
 */

import { RouterAgent } from './agents/router-agent.js';
import { CoderAgent } from './agents/coder-agent.js';
import { ReviewerAgent } from './agents/reviewer-agent.js';
import { ResearcherAgent } from './agents/researcher-agent.js';
// BaseAgent is abstract or just a base, specific agents are needed.
import { BaseAgent } from './agents/base-agent.js';

/**
 * Message types for inter-agent communication.
 */
interface Message {
    from: string;
    to: string;
    type: string;
    content: string;
    timestamp: string;
}

/**
 * Simple message bus for agent communication.
 */
export class MessageBus {
    private messages: Message[] = [];

    /**
     * Send a message from one agent to another.
     */
    send(fromAgent: string, toAgent: string, messageType: string, content: string): void {
        const message: Message = {
            from: fromAgent,
            to: toAgent,
            type: messageType,
            content: content,
            timestamp: new Date().toISOString(),
        };
        this.messages.push(message);
    }

    /**
     * Get relevant message context for a specific agent.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getContextFor(agentName: string): any[] {
        return this.messages.filter(msg => msg.to === agentName || msg.from === agentName);
    }

    /**
     * Get all messages in chronological order.
     */
    getAllMessages(): Message[] {
        return [...this.messages];
    }

    /**
     * Clear all messages from the bus.
     */
    clear(): void {
        this.messages = [];
    }
}

/**
 * Orchestrates multi-agent collaboration using the Router-Worker pattern.
 */
export class SwarmOrchestrator {
    private messageBus: MessageBus;
    private router: RouterAgent;
    private workers: Record<string, BaseAgent>;

    constructor() {
        console.log('🪐 Initializing Antigravity Swarm...');

        // Initialize message bus
        this.messageBus = new MessageBus();

        // Initialize router
        console.log('   🧭 Creating Router agent...');
        this.router = new RouterAgent();

        // Initialize worker agents
        console.log('   💻 Creating Coder agent...');
        console.log('   🔍 Creating Reviewer agent...');
        console.log('   📚 Creating Researcher agent...');
        this.workers = {
            coder: new CoderAgent(),
            reviewer: new ReviewerAgent(),
            researcher: new ResearcherAgent(),
        };

        console.log(`✅ Swarm initialized with ${Object.keys(this.workers).length} specialist agents!\n`);
    }

    /**
     * Execute a user task using the swarm.
     */
    async execute(userTask: string, verbose: boolean = true): Promise<string> {
        if (verbose) {
            console.log(`🎯 Task Received: ${userTask}\n`);
            console.log('='.repeat(70));
        }

        // Step 1: Router analyzes and creates delegation plan
        if (verbose) {
            console.log('\n🧭 [Router] Analyzing task and creating delegation plan...');
        }

        const delegations = await this.router.analyzeAndDelegate(userTask);

        if (verbose) {
            console.log(`   📋 Delegation plan created with ${delegations.length} step(s):`);
            delegations.forEach((delegation, i) => {
                console.log(`      ${i + 1}. ${delegation.agent} → ${delegation.task}`);
            });
        }

        // Step 2: Execute delegations
        const results: string[] = [];
        for (const [i, delegation] of delegations.entries()) {
            const agentName = delegation.agent;
            const agentTask = delegation.task;

            if (verbose) {
                console.log(`\n${'='.repeat(70)}`);
                console.log(`📤 [Router → ${agentName.charAt(0).toUpperCase() + agentName.slice(1)}] Delegating task ${i + 1}/${delegations.length}`);
                console.log(`   Task: ${agentTask}`);
            }

            // Record delegation in message bus
            this.messageBus.send('router', agentName, 'task', agentTask);

            // Get worker agent
            const worker = this.workers[agentName];
            if (!worker) {
                const result = `Error: Unknown agent '${agentName}'`;
                results.push(result);
                continue;
            }

            // Get context for the worker
            const context = this.messageBus.getContextFor(agentName);

            // Execute task
            if (verbose) {
                console.log(`\n🔧 [${agentName.charAt(0).toUpperCase() + agentName.slice(1)}] Executing task...`);
            }

            const result = await worker.execute(agentTask, context);
            results.push(result);

            // Record result in message bus
            this.messageBus.send(agentName, 'router', 'result', result);

            if (verbose) {
                console.log(`✅ [${agentName.charAt(0).toUpperCase() + agentName.slice(1)}] Completed!`);
                console.log(`   Result preview: ${result.substring(0, 150)}...`);
            }
        }

        // Step 3: Router synthesizes final result
        if (verbose) {
            console.log(`\n${'='.repeat(70)}`);
            console.log('\n🧭 [Router] Synthesizing final results...');
        }

        const finalResult = await this.router.synthesizeResults(delegations, results);

        if (verbose) {
            console.log('\n' + '='.repeat(70));
            console.log('🎉 Task Completed!\n');
        }

        return finalResult;
    }

    /**
     * Get the complete message log for debugging.
     */
    getMessageLog(): Message[] {
        return this.messageBus.getAllMessages();
    }

    /**
     * Reset the swarm state.
     */
    reset(): void {
        this.messageBus.clear();
        this.router.resetHistory();
        Object.values(this.workers).forEach(worker => worker.resetHistory());
    }
}
