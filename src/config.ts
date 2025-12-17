/**
 * Configuration management for the Antigravity Agent.
 *
 * Uses zod for schema validation and dotenv for environment loading.
 */

import { config } from 'dotenv';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

/**
 * Schema for MCP server configuration.
 */
export const MCPServerConfigSchema = z.object({
    name: z.string().describe('Unique name for the MCP server'),
    transport: z.enum(['stdio', 'http', 'streamable-http', 'sse']).default('stdio'),
    command: z.string().optional().describe('Command to run for stdio transport'),
    args: z.array(z.string()).default([]).describe('Arguments for the command'),
    url: z.string().optional().describe('URL for http/sse transport'),
    env: z.record(z.string()).default({}).describe('Environment variables for the server'),
    enabled: z.boolean().default(true).describe('Whether this server is enabled'),
});

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

/**
 * Main application settings schema.
 */
const SettingsSchema = z.object({
    // Google GenAI Configuration
    GOOGLE_API_KEY: z.string().optional().default(''),
    GEMINI_MODEL_NAME: z.string().default('gemini-1.5-pro'),
    GCP_PROJECT: z.string().optional().describe('Google Cloud Project ID for Vertex AI'),
    GCP_LOCATION: z.string().default('us-central1').describe('Google Cloud Location for Vertex AI'),

    // Agent Configuration
    AGENT_NAME: z.string().default('AntigravityAgent'),
    DEBUG_MODE: z.boolean().default(false),

    // Memory Configuration
    MEMORY_FILE: z.string().default('agent_memory.json'),

    // MCP Configuration
    MCP_ENABLED: z.boolean().default(false),
    MCP_SERVERS_CONFIG: z.string().default('mcp_servers.json'),
    MCP_CONNECTION_TIMEOUT: z.number().default(30),
    MCP_TOOL_PREFIX: z.string().default('mcp_'),
});

export type Settings = z.infer<typeof SettingsSchema>;

/**
 * Parse boolean from environment variable string.
 */
function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse number from environment variable string.
 */
function parseEnvNumber(value: string | undefined, defaultValue: number): number {
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load settings from environment variables.
 */
function loadSettings(): Settings {
    const rawSettings = {
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
        GEMINI_MODEL_NAME: process.env.GEMINI_MODEL_NAME || 'gemini-1.5-pro',
        GCP_PROJECT: process.env.GCP_PROJECT,
        GCP_LOCATION: process.env.GCP_LOCATION || 'us-central1',
        AGENT_NAME: process.env.AGENT_NAME || 'AntigravityAgent',
        DEBUG_MODE: parseEnvBoolean(process.env.DEBUG_MODE, false),
        MEMORY_FILE: process.env.MEMORY_FILE || 'agent_memory.json',
        MCP_ENABLED: parseEnvBoolean(process.env.MCP_ENABLED, false),
        MCP_SERVERS_CONFIG: process.env.MCP_SERVERS_CONFIG || 'mcp_servers.json',
        MCP_CONNECTION_TIMEOUT: parseEnvNumber(process.env.MCP_CONNECTION_TIMEOUT, 30),
        MCP_TOOL_PREFIX: process.env.MCP_TOOL_PREFIX || 'mcp_',
    };

    return SettingsSchema.parse(rawSettings);
}

/**
 * Load MCP server configurations from JSON file.
 */
export function loadMCPServerConfigs(configPath: string): MCPServerConfig[] {
    const absolutePath = path.isAbsolute(configPath)
        ? configPath
        : path.resolve(process.cwd(), configPath);

    if (!fs.existsSync(absolutePath)) {
        console.log(`   ⚠️ MCP config file not found: ${absolutePath}`);
        return [];
    }

    try {
        const content = fs.readFileSync(absolutePath, 'utf-8');
        const data = JSON.parse(content);
        const servers = data.servers || [];

        return servers
            .filter((s: Record<string, unknown>) => s.enabled !== false)
            .map((s: Record<string, unknown>) => MCPServerConfigSchema.parse(s));
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.log(`   ❌ Invalid JSON in MCP config: ${error.message}`);
        } else {
            console.log(`   ❌ Error loading MCP config: ${error}`);
        }
        return [];
    }
}

/**
 * Global settings instance.
 */
export const settings = loadSettings();
