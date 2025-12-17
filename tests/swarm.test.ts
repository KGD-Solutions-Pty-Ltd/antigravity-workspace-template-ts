/**
 * Tests for SwarmOrchestrator.
 */

import { describe, it, expect } from 'vitest';
import { SwarmOrchestrator } from '../src/swarm.js';

describe('SwarmOrchestrator', () => {
    it('initializes with all agents', () => {
        const swarm = new SwarmOrchestrator();
        // Use any cast to access private properties for testing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const workers = (swarm as any).workers;

        expect(workers).toBeDefined();
        expect(workers.coder).toBeDefined();
        expect(workers.reviewer).toBeDefined();
        expect(workers.researcher).toBeDefined();
    });
});
