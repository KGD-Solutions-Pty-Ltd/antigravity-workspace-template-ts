/**
 * MCP Tools Integration Module.
 *
 * Provides utility functions and tools for interacting with MCP servers
 * from within the Antigravity agent ecosystem.
 */

import { settings } from '../config.js';
import { MCPClientManager } from '../mcp-client.js';

// Global MCP manager instance
let globalMcpManager: MCPClientManager | null = null;

/**
 * Set the global MCP manager instance.
 */
export function setMcpManager(manager: MCPClientManager): void {
    globalMcpManager = manager;
}

/**
 * List all configured MCP servers and their connection status.
 */
export async function listMcpServers(): Promise<string> {
    const manager = globalMcpManager;

    if (!manager) {
        return 'MCP integration is not initialized. Enable it in settings.';
    }

    const status = manager.getStatus();

    if (!status.enabled) {
        return 'MCP integration is disabled. Set MCP_ENABLED=true in your .env file.';
    }

    const servers = status.servers as Record<string, any>;
    if (!servers || Object.keys(servers).length === 0) {
        return 'No MCP servers configured. Add servers to mcp_servers.json';
    }

    const lines = ['📡 MCP Servers Status:\n'];

    Object.entries(servers).forEach(([name, info], index) => {
        const statusIcon = info.connected ? '✅' : '❌';
        const statusText = info.connected ? 'Connected' : 'Disconnected';

        let line = `  ${index + 1}. ${name} (${info.transport}) - ${statusText} ${statusIcon}`;

        if (info.connected) {
            line += ` - ${info.toolsCount} tools`;
        } else if (info.error) {
            line += `\n     Error: ${info.error}`;
        }

        lines.push(line);
    });

    return lines.join('\n');
}

Object.defineProperty(listMcpServers, 'description', {
    value: 'List all configured MCP servers and their connection status.',
});

/**
 * List all available tools from MCP servers.
 */
export async function listMcpTools(args: { serverName?: string }): Promise<string> {
    const { serverName } = args;
    const manager = globalMcpManager;

    if (!manager) {
        return 'MCP integration is not initialized.';
    }

    const tools = manager.getAllTools();

    if (tools.length === 0) {
        return 'No MCP tools available. Check server connections.';
    }

    // Group tools by server
    const toolsByServer: Record<string, any[]> = {};
    for (const tool of tools) {
        if (serverName && tool.serverName !== serverName) {
            continue;
        }

        if (!toolsByServer[tool.serverName]) {
            toolsByServer[tool.serverName] = [];
        }
        toolsByServer[tool.serverName].push(tool);
    }

    if (Object.keys(toolsByServer).length === 0) {
        return `No tools found for server: ${serverName}`;
    }

    const lines = ['🔧 Available MCP Tools:\n'];

    for (const [srvName, srvTools] of Object.entries(toolsByServer)) {
        lines.push(`\n[${srvName}] ${srvTools.length} tool(s):`);

        for (const tool of srvTools) {
            const prefixedName = `${settings.MCP_TOOL_PREFIX}${tool.serverName}_${tool.originalName}`; // crude reconstruction if not using helper
            // Ideally use a helper or the tool object should have it, but for listing we construct it or use what we have
            // The python code used tool.get_prefixed_name.
            // In TS mcp-client, valid names are generated in getAllToolsAsCallables. 
            // But getAllTools returns raw MCPTool objects.
            // Let's reconstruct consistent with mcp-client.

            const desc = tool.description.length > 60
                ? tool.description.substring(0, 60) + '...'
                : tool.description;

            lines.push(`  • ${prefixedName}`);
            lines.push(`    ${desc}`);
        }
    }

    return lines.join('\n');
}

Object.defineProperty(listMcpTools, 'description', {
    value: 'List all available tools from MCP servers. Args: serverName (optional string)',
});

/**
 * Perform a health check on all MCP connections.
 */
export async function mcpHealthCheck(): Promise<string> {
    const manager = globalMcpManager;

    if (!manager) {
        return '❌ MCP integration is not initialized.';
    }

    const status = manager.getStatus();

    if (!status.enabled) {
        return '⚠️ MCP integration is disabled.';
    }

    const servers = status.servers as Record<string, any>;
    if (!servers || Object.keys(servers).length === 0) {
        return '⚠️ No MCP servers configured.';
    }

    const connected = Object.values(servers).filter((s) => s.connected).length;
    const total = Object.keys(servers).length;

    const lines = [
        '🏥 MCP Health Check',
        `   Status: ${connected}/${total} servers connected`,
        '',
    ];

    for (const [name, info] of Object.entries(servers)) {
        if (info.connected) {
            lines.push(`   ✅ ${name}: Healthy (${info.toolsCount} tools)`);
        } else {
            const error = info.error || 'Unknown error';
            lines.push(`   ❌ ${name}: Unhealthy - ${error}`);
        }
    }

    return lines.join('\n');
}

Object.defineProperty(mcpHealthCheck, 'description', {
    value: 'Perform a health check on all MCP connections.',
});
