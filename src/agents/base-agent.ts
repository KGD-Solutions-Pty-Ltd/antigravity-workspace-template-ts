/**
 * Base Agent class for all specialist agents in the swarm.
 *
 * Provides common functionality for agent execution, context management,
 * and communication with the Gemini API.
 */

import { GoogleGenAI } from '@google/genai';
import { settings } from '../config.js';

/**
 * Base class for all agents in the swarm.
 */
export class BaseAgent {
    public role: string;
    public systemPrompt: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public conversationHistory: Record<string, string>[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private client: any;
    private model: any | null = null;

    constructor(role: string, systemPrompt: string) {
        this.role = role;
        this.systemPrompt = systemPrompt;
        this.conversationHistory = [];

        // Initialize Gemini client
        const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
        const hasAuth = settings.GOOGLE_API_KEY || (settings.GCP_PROJECT && settings.GCP_LOCATION);
        const shouldUseDummy = isTest || !hasAuth;

        if (shouldUseDummy) {
            // Dummy client for testing
            this.client = {
                models: {
                    generateContent: async () => ({
                        text: () => `[${role}] Task completed`
                    })
                }
            };
            this.model = this.client;
        } else {
            try {
                if (settings.GOOGLE_API_KEY) {
                    this.client = new GoogleGenAI({ apiKey: settings.GOOGLE_API_KEY });
                } else if (settings.GCP_PROJECT) {
                    // console.log(`🔌 [${role}] Using Vertex AI`);
                    this.client = new GoogleGenAI({
                        vertexai: true,
                        project: settings.GCP_PROJECT,
                        location: settings.GCP_LOCATION
                    });
                }
                // @ts-ignore
                this.model = this.client;
            } catch (error) {
                console.log(`⚠️ ${role} agent: genai client not initialized: ${error}`);
                // Fallback to dummy client
                this.client = {
                    models: {
                        generateContent: async () => ({
                            text: () => `[${role}] Task completed`
                        })
                    }
                };
                this.model = this.client;
            }
        }
    }

    /**
     * Execute a task with optional context from other agents.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(task: string, context: any[] | null = null): Promise<string> {
        // Build the full prompt
        const promptParts = [this.systemPrompt, `\n\nTask: ${task}`];

        // Add context if provided
        if (context && context.length > 0) {
            let contextStr = '\n\nContext from other agents:\n';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            context.forEach((msg: any) => {
                contextStr += `[${msg.from || 'unknown'}]: ${msg.content || ''}\n`;
            });
            promptParts.push(contextStr);
        }

        const fullPrompt = promptParts.join('');

        // Call Gemini API
        try {
            if (!this.model) {
                return `[${this.role}] Error: Model not initialized`;
            }

            // @ts-ignore
            const result = await this.model.models.generateContent({
                model: settings.GEMINI_MODEL_NAME,
                contents: fullPrompt
            });
            const output = result.text ? result.text().trim() : (result.response ? result.response.text().trim() : JSON.stringify(result));

            // Store in conversation history
            this.conversationHistory.push({
                role: 'user',
                content: task,
            });
            this.conversationHistory.push({
                role: 'assistant',
                content: output,
            });

            return output;
        } catch (error) {
            return `[${this.role}] Error executing task: ${error}`;
        }
    }

    /**
     * Clear the conversation history.
     */
    resetHistory(): void {
        this.conversationHistory = [];
    }
}
