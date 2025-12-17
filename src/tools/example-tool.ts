/**
 * Example tools for the agent.
 */

/**
 * Simulates a web search (mock implementation).
 */
export async function webSearch(args: { query: string }): Promise<string> {
    const { query } = args;
    return `[Mock] Search results for: ${query}\n1. TypeScript Documentation\n2. Google Gemini API\n3. Model Context Protocol`;
}

Object.defineProperty(webSearch, 'description', {
    value: 'Performs a web search for the given query. Args: query (string)',
});
