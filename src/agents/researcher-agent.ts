/**
 * Researcher Agent - Specialist for information gathering and analysis.
 */

import { BaseAgent } from './base-agent.js';

export class ResearcherAgent extends BaseAgent {
    constructor() {
        const systemPrompt = `You are the Researcher Agent, a specialist in information gathering.

Your responsibilities:
1. Research topics to provide context for coding tasks
2. Search for libraries, tools, and best practices
3. Analyze data and summarize findings
4. verify assumptions and requirements

Provide clear, sourced information to support technical decisions.`;

        super('researcher', systemPrompt);
    }
}
