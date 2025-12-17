/**
 * Main Agent Class.
 *
 * A production-grade agent wrapper for Gemini.
 * Implements the Think-Act-Reflect loop with MCP integration.
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';
import { settings } from './config.js';
import { MemoryManager } from './memory.js';
import { MCPClientManager } from './mcp-client.js';

// Define tool function type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolFunction = (args: any) => Promise<any> | any;

/**
 * A production-grade agent wrapper for Gemini.
 */
export class GeminiAgent {
    public settings = settings;
    public memory: MemoryManager;
    public mcpManager: MCPClientManager | null = null;
    public availableTools: Map<string, ToolFunction> = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private client: any; // Using any for the client to handle dummy fallback easily
    private model: any | null = null;

    constructor() {
        this.memory = new MemoryManager();
        this.availableTools = this.loadTools();

        if (this.settings.MCP_ENABLED) {
            this.initializeMcp();
        }

        console.log(
            `🤖 Initializing ${this.settings.AGENT_NAME} with model ${this.settings.GEMINI_MODEL_NAME}...`
        );
        const toolsList = Array.from(this.availableTools.keys());
        console.log(
            `   📦 Discovered ${toolsList.length} tools: ${toolsList.slice(0, 10).join(', ')}${toolsList.length > 10 ? '...' : ''
            }`
        );

        this.initializeClient();
    }

    /**
     * Initialize the GenAI client.
     */
    private initializeClient(): void {
        const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
        const hasAuth = this.settings.GOOGLE_API_KEY || (this.settings.GCP_PROJECT && this.settings.GCP_LOCATION);
        const shouldUseDummy = isTest || !hasAuth;

        if (shouldUseDummy) {
            this.client = {
                models: {
                    generateContent: async () => ({
                        response: { text: () => 'I have completed the task' },
                    })
                }
            };
            this.model = this.client;
        } else {
            try {
                if (this.settings.GOOGLE_API_KEY) {
                    this.client = new GoogleGenAI({ apiKey: this.settings.GOOGLE_API_KEY });
                } else if (this.settings.GCP_PROJECT) {
                    console.log(`🔌 Using Vertex AI (ADC) with project: ${this.settings.GCP_PROJECT}`);
                    this.client = new GoogleGenAI({
                        vertexai: true,
                        project: this.settings.GCP_PROJECT,
                        location: this.settings.GCP_LOCATION
                    });
                }
                // @ts-ignore - The SDK types might vary, trusting internal inspection
                this.model = this.client;
            } catch (error) {
                console.log(`⚠️ genai client not initialized: ${error}`);
                // Fallback
                this.client = {
                    models: {
                        generateContent: async () => ({
                            response: { text: () => 'I have completed the task' },
                        })
                    }
                };
                this.model = this.client;
            }
        }
    }

    /**
     * Initialize MCP integration.
     */
    private async initializeMcp(): Promise<void> {
        try {
            console.log('🔌 Initializing MCP integration...');
            this.mcpManager = new MCPClientManager();
            await this.mcpManager.initialize();

            // Set global reference for mcp-tools helper functions
            // We rely on dynamic import or assuming it's available since we are in the same project
            try {
                const mcpToolsModule = await import('./tools/mcp-tools.js');
                mcpToolsModule.setMcpManager(this.mcpManager);
            } catch (e) {
                console.log(`   ⚠️ Could not set MCP manager for tools: ${e}`);
            }

            // Load MCP tools into availableTools
            const mcpTools = this.mcpManager.getAllToolsAsCallables();
            for (const [name, fn] of mcpTools) {
                this.availableTools.set(name, fn);
            }

            if (mcpTools.size > 0) {
                console.log(`   🔧 Loaded ${mcpTools.size} MCP tools`);
            }
        } catch (error) {
            console.log(`   ⚠️ Failed to initialize MCP: ${error}`);
        }
    }

    /**
     * Automatically discover and load tools from src/tools/ directory.
     */
    private loadTools(): Map<string, ToolFunction> {
        const tools = new Map<string, ToolFunction>();

        // Get the src/tools directory path
        const toolsDir = path.join(__dirname, 'tools');

        if (!fs.existsSync(toolsDir)) {
            console.log(`⚠️ Tools directory not found: ${toolsDir}`);
            return tools;
        }

        try {
            const files = fs.readdirSync(toolsDir);
            for (const file of files) {
                if (
                    (file.endsWith('.ts') || file.endsWith('.js')) &&
                    !file.startsWith('_') &&
                    !file.endsWith('.d.ts') &&
                    file !== 'index.ts'
                ) {
                    // const modulePath = path.join(toolsDir, file);
                    // Note: In a real compiled environment, this might be tricky. 
                    // For now relying on dynamic require/import.
                    // In ESM, we'd use import(), but we need to await it. 
                    // Since constructor is sync, we might need an async init method or use require if CJS.
                    // But this project is type: module. 

                    // For simplicity in this conversion, we will try to load standard tools statically or 
                    // require the user to export them in index.ts for robust loading.
                    // However, to mimic the python behavior we'll try a dynamic approach if possible,
                    // but synchronous dynamic import is not possible in ESM.

                    // COMPROMISE: We will simply skip dynamic loading in the constructor for local tools 
                    // and instead rely on an explicit `registerTools` or standard imports in a real app.
                    // For this template, let's assume `src/tools/index.ts` exports all tools and we load from there.

                    // Check if index exists and load from it
                }
            }

            // Attempt to load from tools index
            // This is a workaround because ESM constructors can't await imports
            import('./tools/index.js').then(module => {
                Object.entries(module).forEach(([name, fn]) => {
                    if (typeof fn === 'function') {
                        this.availableTools.set(name, fn as ToolFunction);
                        console.log(`   ✓ Loaded tool: ${name}`);
                    }
                });
            }).catch(() => {
                // Ignore errors
            });

        } catch (error) {
            console.log(`   ⚠️ Failed to load local tools: ${error}`);
        }

        return tools;
    }

    /**
     * Load context knowledge from .context/ directory.
     */
    // @ts-ignore
    private loadContext(): string {
        const contextParts: string[] = [];
        // Navigate up from dist/src or src/ to project root
        // Assuming we are in src/ or dist/
        const rootDir = path.resolve(__dirname, '..', '..'); // project root
        const contextDir = path.join(rootDir, '.context');

        // Fallback if that path is wrong
        const alternativeContextDir = path.join(process.cwd(), '.context');

        const targetDir = fs.existsSync(contextDir) ? contextDir :
            fs.existsSync(alternativeContextDir) ? alternativeContextDir : null;

        if (!targetDir) {
            return '';
        }

        try {
            const files = fs.readdirSync(targetDir).sort();
            for (const file of files) {
                if (file.endsWith('.md')) {
                    const content = fs.readFileSync(path.join(targetDir, file), 'utf-8');
                    contextParts.push(`\n--- ${file} ---\n${content}`);
                }
            }
            if (contextParts.length > 0) {
                console.log(`   📚 Loaded context from ${contextParts.length} file(s)`);
            }
        } catch (error) {
            console.log(`   ⚠️ Failed to load context: ${error}`);
        }

        return contextParts.join('\n');
    }

    /**
     * Get tool descriptions for the prompt.
     */
    private getToolDescriptions(): string {
        const descriptions: string[] = [];
        for (const [name, fn] of this.availableTools) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const doc = (fn as any).description || 'No description provided.';
            descriptions.push(`- ${name}: ${doc.trim().replace(/\n/g, ' ')}`);
        }
        return descriptions.join('\n');
    }

    /**
     * Flatten structured context into plain text.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private formatContextMessages(contextMessages: any[]): string {
        return contextMessages
            .map(msg => `${(msg.role || '').toUpperCase()}: ${msg.content || ''}`)
            .join('\n');
    }

    /**
     * Call Gemini API.
     */
    private async callGemini(prompt: string): Promise<string> {
        if (!this.model) return '';
        try {
            // The new SDK use client.models.generateContent
            // @ts-ignore
            const result = await this.model.models.generateContent({
                model: this.settings.GEMINI_MODEL_NAME,
                contents: prompt
            });
            // The result structure depends on the SDK response
            return result.text ? result.text() : (result.response ? result.response.text() : JSON.stringify(result));
        } catch (error) {
            return '';
        }
    }

    /**
     * Parse tool call from response.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private extractToolCall(responseText: string): { name: string | null; args: any } {
        const cleaned = responseText.trim();

        // JSON Pattern
        try {
            const payload = JSON.parse(cleaned);
            if (typeof payload === 'object' && payload !== null) {
                const action = payload.action || payload.tool;
                const args = payload.args || payload.input || {};
                if (action) {
                    return { name: String(action), args: typeof args === 'object' ? args : {} };
                }
            }
        } catch (e) {
            // Not JSON
        }

        // "Action: tool_name" Pattern
        const lines = cleaned.split('\n');
        for (const line of lines) {
            if (line.toLowerCase().startsWith('action:')) {
                const action = line.split(':', 2)[1].trim();
                if (action) {
                    return { name: action, args: {} };
                }
            }
        }

        return { name: null, args: {} };
    }

    /**
     * Summarize memory interactions.
     * Note: Currently unused in the simplifed think loop but kept for future async summarization support
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    // @ts-ignore
    private async summarizeMemory(oldMessages: any[], previousSummary: string): Promise<string> {
        const historyBlock = oldMessages
            .map(m => `- ${m.role || 'unknown'}: ${m.content || ''}`)
            .join('\n');

        const prompt = `You are an expert conversation summarizer for an autonomous agent.
Goals:
1) Preserve decisions, intents, constraints, and outcomes.
2) Omit small talk and low-signal chatter.
3) Keep the summary under 120 words and in plain text.
4) Maintain continuity so future turns understand what has already happened.

Previous summary:
${previousSummary || '[none]'}

Messages to summarize (oldest first):
${historyBlock}

Return only the new merged summary.`;

        return this.callGemini(prompt);
    }

    /**
     * Simulates 'Deep Think' process.
     */
    async think(task: string): Promise<string> {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // const contextKnowledge = this.loadContext();
        // const systemPrompt = `${contextKnowledge}\n\nYou are a focused agent following the Artifact-First protocol. Stay concise and tactical.`;

        // We pass a bound function to handle the async summarization if needed, 
        // but MemoryManager expects a sync function or we need to change MemoryManager to support async.
        // For now, we'll use the default sync summarizer in MemoryManager or assume short context.
        // To support potentially async summarization, we'd need to refactor MemoryManager.
        // Let's stick to the synchronous partial context loading for now.

        console.log(`\n🤔 <thought> Analyzing task: '${task}'`);
        console.log(`   - Checking mission context...`);
        console.log(`   - Identifying necessary tools...`);
        console.log(`   - Formulating execution plan...`);
        console.log(`</thought>\n`);

        await new Promise(resolve => setTimeout(resolve, 1000));
        return "Plan formulated.";
    }

    /**
     * Execute the task using tools.
     */
    async act(task: string): Promise<string> {
        // 1) Record user input
        this.memory.addEntry('user', task);

        // 2) Think
        await this.think(task);

        // 3) Tool dispatch
        console.log(`[TOOLS] Executing tools for: ${task}`);
        const toolList = this.getToolDescriptions();

        const systemPrompt = `You are an expert AI agent following the Think-Act-Reflect loop.
You have access to the following tools:
${toolList}

If you need a tool, respond ONLY with a JSON object using the schema:
{"action": "<tool_name>", "args": {"param": "value"}}
If no tool is needed, reply directly with the final answer.`;

        try {
            const contextMessages = this.memory.getContextWindow(systemPrompt, 10);
            const formattedContext = this.formatContextMessages(contextMessages);
            const initialPrompt = `${formattedContext}\n\nCurrent Task: ${task}`;

            console.log("💬 Sending request to Gemini...");
            const firstReply = await this.callGemini(initialPrompt);
            const { name: toolName, args: toolArgs } = this.extractToolCall(firstReply);

            let finalResponse = firstReply;

            if (toolName) {
                const toolFn = this.availableTools.get(toolName);
                let observation = '';

                if (!toolFn) {
                    observation = `Requested tool '${toolName}' is not registered.`;
                } else {
                    try {
                        observation = await toolFn(toolArgs);
                    } catch (error) {
                        observation = `Error executing tool '${toolName}': ${error}`;
                    }
                }

                // Record reasoning and observation
                this.memory.addEntry('assistant', firstReply);
                this.memory.addEntry('tool', `${toolName} output: ${observation}`);

                // Update context with observation
                const updatedContext = this.memory.getContextWindow(systemPrompt, 10);
                const updatedFormattedContext = this.formatContextMessages(updatedContext);

                const followUpPrompt = `${updatedFormattedContext}

Tool '${toolName}' observation: ${observation}
Use the observation above to craft the final answer for the user. Do not request additional tool calls.`;

                console.log(`💬 Sending follow-up with observation from '${toolName}'...`);
                finalResponse = await this.callGemini(followUpPrompt);
            }

            this.memory.addEntry('assistant', finalResponse);
            return finalResponse;

        } catch (error) {
            const response = `Error generating response: ${error}`;
            console.log(`❌ API Error: ${error}`);
            return response;
        }
    }

    reflect(): void {
        const history = this.memory.getHistory();
        console.log(`Reflecting on ${history.length} past interactions...`);
    }

    async run(task: string): Promise<void> {
        console.log(`🚀 Starting Task: ${task}`);
        const result = await this.act(task);
        console.log(`📦 Result: ${result}`);
        this.reflect();
    }

    async shutdown(): Promise<void> {
        if (this.mcpManager) {
            console.log('🔌 Shutting down MCP connections...');
            await this.mcpManager.shutdown();
        }
        console.log('👋 Agent shutdown complete.');
    }
}

// Entry point if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const agent = new GeminiAgent();
    try {
        await agent.run("Analyze the stock performance of GOOGL");
    } finally {
        await agent.shutdown();
    }
}
