/**
 * MCP (Model Context Protocol) Client Manager.
 *
 * Provides a unified interface for connecting to multiple MCP servers
 * and exposing their tools as callable functions for the Antigravity agent.
 */

import { settings, loadMCPServerConfigs, MCPServerConfig } from './config.js';

/**
 * Represents a tool discovered from an MCP server.
 */
export interface MCPTool {
    name: string;
    description: string;
    serverName: string;
    inputSchema: Record<string, unknown>;
    originalName: string;
}

/**
 * Represents an active connection to an MCP server.
 */
export interface MCPServerConnection {
    config: MCPServerConfig;
    session: unknown | null;
    readStream: unknown | null;
    writeStream: unknown | null;
    tools: MCPTool[];
    connected: boolean;
    error: string | null;
    clientCm: unknown | null;
}

/**
 * Tool function type.
 */
export type ToolFunction = (args: Record<string, unknown>) => Promise<string>;

/**
 * Get the prefixed name for an MCP tool.
 */
function getPrefixedName(tool: MCPTool, prefix: string = ''): string {
    if (prefix) {
        return `${prefix}${tool.serverName}_${tool.originalName}`;
    }
    return `${tool.serverName}_${tool.originalName}`;
}

/**
 * Manages connections to multiple MCP servers and provides a unified
 * interface for tool discovery and invocation.
 */
export class MCPClientManager {
    private configPath: string;
    private servers: Map<string, MCPServerConnection> = new Map();
    private toolPrefix: string;
    private initialized = false;

    constructor(configPath?: string) {
        this.configPath = configPath || settings.MCP_SERVERS_CONFIG;
        this.toolPrefix = settings.MCP_TOOL_PREFIX;
    }

    /**
     * Initialize connections to all configured MCP servers.
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        if (!settings.MCP_ENABLED) {
            console.log('   ℹ️ MCP integration is disabled');
            return;
        }

        console.log('🔌 Initializing MCP Client Manager...');

        const configs = loadMCPServerConfigs(this.configPath);

        if (configs.length === 0) {
            console.log('   ℹ️ No MCP servers configured');
            return;
        }

        for (const config of configs) {
            await this.connectServer(config);
        }

        const connectedCount = Array.from(this.servers.values()).filter((s) => s.connected).length;
        const totalTools = Array.from(this.servers.values()).reduce(
            (sum, s) => sum + s.tools.length,
            0
        );

        console.log(`   ✅ Connected to ${connectedCount}/${configs.length} MCP servers`);
        console.log(`   📦 Discovered ${totalTools} MCP tools`);

        this.initialized = true;
    }

    /**
     * Establish connection to a single MCP server.
     */
    private async connectServer(config: MCPServerConfig): Promise<void> {
        const connection: MCPServerConnection = {
            config,
            session: null,
            readStream: null,
            writeStream: null,
            tools: [],
            connected: false,
            error: null,
            clientCm: null,
        };

        try {
            console.log(`   🔗 Connecting to MCP server: ${config.name} (${config.transport})...`);

            if (config.transport === 'stdio') {
                await this.connectStdio(connection);
            } else if (config.transport === 'http' || config.transport === 'streamable-http') {
                await this.connectHttp(connection);
            } else if (config.transport === 'sse') {
                await this.connectSse(connection);
            } else {
                throw new Error(`Unsupported transport: ${config.transport}`);
            }

            // Discover tools if connected
            if (connection.connected && connection.session) {
                await this.discoverTools(connection);
                console.log(`      ✓ ${config.name}: ${connection.tools.length} tools discovered`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            connection.error = errorMessage;

            if (errorMessage.includes('Cannot find module')) {
                console.log(
                    `      ⚠️ ${config.name}: MCP library not installed. Run: npm install @modelcontextprotocol/sdk`
                );
            } else {
                console.log(`      ⚠️ ${config.name}: Connection failed - ${errorMessage}`);
            }
        }

        this.servers.set(config.name, connection);
    }

    /**
     * Connect to an MCP server using stdio transport.
     */
    private async connectStdio(connection: MCPServerConnection): Promise<void> {
        try {
            const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
            const { StdioClientTransport } = await import(
                '@modelcontextprotocol/sdk/client/stdio.js'
            );

            const config = connection.config;

            if (!config.command) {
                throw new Error("stdio transport requires 'command' field");
            }

            const transport = new StdioClientTransport({
                command: config.command,
                args: config.args,
                env: { ...process.env, ...config.env } as Record<string, string>,
            });

            const client = new Client(
                {
                    name: 'antigravity-agent',
                    version: '1.0.0',
                },
                {
                    capabilities: {},
                }
            );

            await client.connect(transport);

            connection.session = client;
            connection.connected = true;
        } catch (error) {
            connection.error = error instanceof Error ? error.message : String(error);
            connection.connected = false;
            throw error;
        }
    }

    /**
     * Connect to an MCP server using HTTP/Streamable HTTP transport.
     */
    private async connectHttp(connection: MCPServerConnection): Promise<void> {
        try {
            const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
            const { StreamableHTTPClientTransport } = await import(
                '@modelcontextprotocol/sdk/client/streamableHttp.js'
            );

            const config = connection.config;

            if (!config.url) {
                throw new Error("http transport requires 'url' field");
            }

            const transport = new StreamableHTTPClientTransport(new URL(config.url));

            const client = new Client(
                {
                    name: 'antigravity-agent',
                    version: '1.0.0',
                },
                {
                    capabilities: {},
                }
            );

            await client.connect(transport);

            connection.session = client;
            connection.connected = true;
        } catch (error) {
            connection.error = error instanceof Error ? error.message : String(error);
            connection.connected = false;
            throw error;
        }
    }

    /**
     * Connect to an MCP server using SSE transport.
     */
    private async connectSse(connection: MCPServerConnection): Promise<void> {
        // SSE is similar to HTTP but uses different client
        await this.connectHttp(connection);
    }

    /**
     * Discover available tools from a connected MCP server.
     */
    private async discoverTools(connection: MCPServerConnection): Promise<void> {
        if (!connection.session) {
            return;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const client = connection.session as any;
            const toolsResponse = await client.listTools();

            for (const tool of toolsResponse.tools) {
                const mcpTool: MCPTool = {
                    name: tool.name,
                    description: tool.description || 'No description provided',
                    serverName: connection.config.name,
                    inputSchema: tool.inputSchema || {},
                    originalName: tool.name,
                };
                connection.tools.push(mcpTool);
            }
        } catch (error) {
            console.log(`      ⚠️ Error discovering tools: ${error}`);
        }
    }

    /**
     * Get all discovered tools from all connected servers.
     */
    getAllTools(): MCPTool[] {
        const allTools: MCPTool[] = [];
        for (const connection of this.servers.values()) {
            if (connection.connected) {
                allTools.push(...connection.tools);
            }
        }
        return allTools;
    }

    /**
     * Convert all MCP tools to callable functions.
     */
    getAllToolsAsCallables(): Map<string, ToolFunction> {
        const callables = new Map<string, ToolFunction>();

        for (const connection of this.servers.values()) {
            if (!connection.connected) {
                continue;
            }

            for (const tool of connection.tools) {
                const prefixedName = getPrefixedName(tool, this.toolPrefix);
                callables.set(prefixedName, this.createToolWrapper(connection, tool));
            }
        }

        return callables;
    }

    /**
     * Create a callable wrapper for an MCP tool.
     */
    private createToolWrapper(connection: MCPServerConnection, tool: MCPTool): ToolFunction {
        const wrapper = async (args: Record<string, unknown>): Promise<string> => {
            if (!connection.connected || !connection.session) {
                return `Error: MCP server '${connection.config.name}' is not connected`;
            }

            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const client = connection.session as any;
                const result = await client.callTool({
                    name: tool.originalName,
                    arguments: args,
                });

                // Extract content from result
                if (result.content && Array.isArray(result.content)) {
                    const contents: string[] = [];
                    for (const content of result.content) {
                        if (content.text) {
                            contents.push(content.text);
                        } else if (content.data) {
                            contents.push(`[Binary data: ${content.data.length} bytes]`);
                        }
                    }
                    return contents.length > 0 ? contents.join('\n') : String(result);
                }

                return String(result);
            } catch (error) {
                return `Error calling MCP tool '${tool.originalName}': ${error}`;
            }
        };

        // Attach metadata for tool discovery
        Object.defineProperty(wrapper, 'name', { value: getPrefixedName(tool, this.toolPrefix) });
        Object.defineProperty(wrapper, 'description', {
            value: `[MCP:${connection.config.name}] ${tool.description}`,
        });

        return wrapper;
    }

    /**
     * Get formatted descriptions of all available MCP tools.
     */
    getToolDescriptions(): string {
        const descriptions: string[] = [];

        for (const connection of this.servers.values()) {
            if (!connection.connected) {
                continue;
            }

            for (const tool of connection.tools) {
                const prefixedName = getPrefixedName(tool, this.toolPrefix);
                const desc = tool.description.trim().replace(/\n/g, ' ');
                descriptions.push(`- ${prefixedName} [MCP:${connection.config.name}]: ${desc}`);
            }
        }

        return descriptions.join('\n');
    }

    /**
     * Gracefully close all MCP server connections.
     */
    async shutdown(): Promise<void> {
        console.log('🔌 Shutting down MCP connections...');

        for (const [name, connection] of this.servers) {
            try {
                if (connection.session) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const client = connection.session as any;
                    if (typeof client.close === 'function') {
                        await client.close();
                    }
                }
                console.log(`   ✓ Disconnected from ${name}`);
            } catch (error) {
                console.log(`   ⚠️ Error disconnecting from ${name}: ${error}`);
            }
        }

        this.servers.clear();
        this.initialized = false;
    }

    /**
     * Get status information about all MCP servers.
     */
    getStatus(): Record<string, unknown> {
        const servers: Record<string, unknown> = {};

        for (const [name, conn] of this.servers) {
            servers[name] = {
                connected: conn.connected,
                transport: conn.config.transport,
                toolsCount: conn.tools.length,
                error: conn.error,
            };
        }

        return {
            enabled: settings.MCP_ENABLED,
            initialized: this.initialized,
            servers,
        };
    }
}

/**
 * Synchronous wrapper for MCPClientManager.
 * Provides blocking methods for environments that don't support async/await at the top level.
 */
export class MCPClientManagerSync {
    private asyncManager: MCPClientManager;

    constructor(configPath?: string) {
        this.asyncManager = new MCPClientManager(configPath);
    }

    /**
     * Initialize MCP connections synchronously.
     */
    initialize(): void {
        // Run the async initialization
        const initPromise = this.asyncManager.initialize();
        // We can't truly block in Node.js, so we just start the initialization
        initPromise.catch((error) => {
            console.error('MCP initialization error:', error);
        });
    }

    /**
     * Get all tools as callables (async operations wrapped).
     */
    getAllToolsAsCallables(): Map<string, ToolFunction> {
        return this.asyncManager.getAllToolsAsCallables();
    }

    /**
     * Get tool descriptions.
     */
    getToolDescriptions(): string {
        return this.asyncManager.getToolDescriptions();
    }

    /**
     * Shutdown connections.
     */
    shutdown(): void {
        this.asyncManager.shutdown().catch((error) => {
            console.error('MCP shutdown error:', error);
        });
    }

    /**
     * Get status information.
     */
    getStatus(): Record<string, unknown> {
        return this.asyncManager.getStatus();
    }

    /**
     * Get the underlying async manager.
     */
    getAsyncManager(): MCPClientManager {
        return this.asyncManager;
    }
}
