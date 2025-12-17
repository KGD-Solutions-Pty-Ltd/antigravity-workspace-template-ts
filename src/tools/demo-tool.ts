/**
 * Test tool for demonstrating dynamic tool discovery.
 *
 * This file demonstrates the zero-config capability - just drop this file
 * into src/tools/ and it becomes available to the agent automatically.
 */

/**
 * Greets the user by name with a friendly message.
 *
 * This is a demonstration tool showing how new tools can be added.
 */
export async function greetUser(args: { name: string }): Promise<string> {
    const { name } = args;
    return `Hello, ${name}! 🎉 Welcome to the Antigravity Agent with TypeScript!`;
}

// Attach description for the agent to read
Object.defineProperty(greetUser, 'description', {
    value: 'Greets the user by name. Args: name (string)',
});

/**
 * Reverses the given text string.
 */
export async function reverseText(args: { text: string }): Promise<string> {
    const { text } = args;
    return text.split('').reverse().join('');
}

Object.defineProperty(reverseText, 'description', {
    value: 'Reverses the given text string. Args: text (string)',
});
