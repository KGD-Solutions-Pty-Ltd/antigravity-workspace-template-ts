/**
 * Memory management for the Antigravity Agent.
 *
 * Simple JSON-file based memory with context window and summarization support.
 */

import * as fs from 'fs';
import { settings } from './config.js';

/**
 * Represents a single memory entry.
 */
export interface MemoryEntry {
    role: string;
    content: string;
    metadata?: Record<string, unknown>;
}

/**
 * Memory file structure.
 */
interface MemoryFile {
    summary: string;
    history: MemoryEntry[];
}

/**
 * Context message for the agent.
 */
export interface ContextMessage {
    role: string;
    content: string;
}

/**
 * Summarizer function type.
 */
export type SummarizerFn = (oldMessages: MemoryEntry[], previousSummary: string) => string;

/**
 * Simple JSON-file based memory manager for the agent.
 */
export class MemoryManager {
    private memoryFile: string;
    private _memory: MemoryEntry[] = [];
    public summary: string = '';

    constructor(memoryFile: string = settings.MEMORY_FILE) {
        this.memoryFile = memoryFile;
        this.loadMemory();
    }

    /**
     * Loads memory from the JSON file if it exists.
     */
    private loadMemory(): void {
        this.summary = '';

        if (!fs.existsSync(this.memoryFile)) {
            this._memory = [];
            return;
        }

        try {
            const content = fs.readFileSync(this.memoryFile, 'utf-8');
            const data = JSON.parse(content);

            if (typeof data === 'object' && !Array.isArray(data)) {
                this.summary = data.summary || '';
                const history = data.history;
                this._memory = Array.isArray(history) ? history : [];
            } else if (Array.isArray(data)) {
                // Backward compatibility for legacy memory files
                this._memory = data;
            } else {
                console.log(`Warning: Unexpected memory format in ${this.memoryFile}. Starting fresh.`);
                this._memory = [];
            }
        } catch (error) {
            console.log(`Warning: Could not decode memory file ${this.memoryFile}. Starting fresh.`);
            this._memory = [];
        }
    }

    /**
     * Saves the current memory state to the JSON file.
     */
    saveMemory(): void {
        const payload: MemoryFile = {
            summary: this.summary,
            history: this._memory,
        };
        fs.writeFileSync(this.memoryFile, JSON.stringify(payload, null, 2), 'utf-8');
    }

    /**
     * Adds a new interaction to memory.
     */
    addEntry(role: string, content: string, metadata?: Record<string, unknown>): void {
        const entry: MemoryEntry = {
            role,
            content,
            metadata: metadata || {},
        };
        this._memory.push(entry);
        this.saveMemory();
    }

    /**
     * Returns the full conversation history.
     */
    getHistory(): MemoryEntry[] {
        return this._memory;
    }

    /**
     * Default summarization that compacts old messages.
     */
    private defaultSummarizer(oldMessages: MemoryEntry[], previousSummary: string): string {
        const lines: string[] = [];
        if (previousSummary) {
            lines.push(previousSummary.trim());
        }
        for (const message of oldMessages) {
            const role = message.role || 'unknown';
            const content = message.content || '';
            lines.push(`${role}: ${content}`);
        }
        return lines.join('\n').trim();
    }

    /**
     * Returns the context window, applying a summary buffer when history exceeds maxMessages.
     */
    getContextWindow(
        systemPrompt: string,
        maxMessages: number,
        summarizer?: SummarizerFn
    ): ContextMessage[] {
        if (!systemPrompt) {
            throw new Error('systemPrompt is required to build the context window.');
        }
        if (maxMessages < 1) {
            throw new Error('maxMessages must be at least 1.');
        }

        const history = this.getHistory();
        const systemMessage: ContextMessage = { role: 'system', content: systemPrompt };

        if (history.length <= maxMessages) {
            return [systemMessage, ...history.map((m) => ({ role: m.role, content: m.content }))];
        }

        const summarizerFn = summarizer || this.defaultSummarizer.bind(this);
        const messagesToSummarize = history.slice(0, -maxMessages).map((msg) => ({ ...msg }));
        const recentHistory = history.slice(-maxMessages).map((msg) => ({ ...msg }));

        let newSummary: string;
        try {
            newSummary = summarizerFn(messagesToSummarize, this.summary);
        } catch (error) {
            throw new TypeError('Summarizer must accept two arguments: (oldMessages, previousSummary).');
        }

        if (typeof newSummary !== 'string') {
            throw new Error('Summarizer must return a string.');
        }

        const previousSummary = this.summary;
        this.summary = newSummary.trim();
        if (this.summary !== previousSummary) {
            this.saveMemory();
        }

        const summaryMessage: ContextMessage = {
            role: 'system',
            content: `Previous Summary: ${this.summary}`,
        };

        return [
            systemMessage,
            summaryMessage,
            ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
        ];
    }

    /**
     * Clears the agent's memory.
     */
    clearMemory(): void {
        this._memory = [];
        this.summary = '';
        this.saveMemory();
    }
}
