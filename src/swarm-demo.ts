/**
 * Swarm Demo Script
 *
 * Demonstrates the multi-agent swarm in action.
 */

import { SwarmOrchestrator } from './swarm.js';
import { settings } from './config.js';

async function runDemo() {
    console.log('🚀 Starting Antigravity Swarm Demo');
    console.log('=================================\n');

    if (!settings.GOOGLE_API_KEY) {
        console.log(
            '⚠️ GOOGLE_API_KEY not found in environment variables.'
        );
        console.log(
            '   The demo will use dummy responses for testing purposes.\n'
        );
    }

    const swarm = new SwarmOrchestrator();

    // Example task that requires multiple specialists
    const task =
        "Create a Python function to calculate Fibonacci numbers efficiently, review it for performance, and explain the time complexity.";

    try {
        const result = await swarm.execute(task);

        console.log('\n✨ Final Result:');
        console.log(result);
    } catch (error) {
        console.error('❌ Error running swarm:', error);
    } finally {
        console.log('\n👋 Demo completed.');
    }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    runDemo().catch(console.error);
}
