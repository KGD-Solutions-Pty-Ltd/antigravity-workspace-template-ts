/**
 * Tests for the GeminiAgent class.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiAgent } from '../src/agent.js';
import { MemoryManager } from '../src/memory.js';

// Mock dependencies
vi.mock('../src/memory.js');

describe('GeminiAgent', () => {
    let agent: GeminiAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GOOGLE_API_KEY = 'dummy';
        // Mock memory instance
        vi.mocked(MemoryManager).mockImplementation(() => ({
            addEntry: vi.fn(),
            getContextWindow: vi.fn().mockReturnValue([]),
            getHistory: vi.fn().mockReturnValue([]),
            summary: '',
            saveMemory: vi.fn(),
            clearMemory: vi.fn(),
            loadMemory: vi.fn(),
            defaultSummarizer: vi.fn(),
        } as unknown as MemoryManager));

        agent = new GeminiAgent();
    });

    it('initializes correctly', () => {
        expect(agent.settings.AGENT_NAME).toBe('AntigravityAgent');
        expect(agent.memory).toBeDefined();
    });

    it('executes the think-act loop', async () => {
        const task = 'Test Task';

        // Mock think to avoid sleep
        const thinkSpy = vi.spyOn(agent, 'think').mockResolvedValue('Plan formulated.');

        // Using dummy client (fallback) so we don't need to mock internals too deeply for this high-level test
        const result = await agent.act(task);

        expect(thinkSpy).toHaveBeenCalledWith(task);
        expect(agent.memory.addEntry).toHaveBeenCalled();
        expect(result).toContain('I have completed the task');
    });

    it('loads tools correctly', () => {
        // This depends on file system presence or mocking fs
        // Since we are running in the actual project structure, it might find real tools
        // Let's just check expectations
        expect(agent.availableTools).toBeDefined();
    });
});
