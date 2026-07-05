import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export async function fetchTwitterIntel(coinSymbol: string) {
    try {
        const sessionCookie = process.env.XACTIONS_SESSION_COOKIE;
        if (!sessionCookie) {
            console.warn("[Ingestion Warning] XACTIONS_SESSION_COOKIE is missing. Returning fallback.");
            return { text: "No social data available", fallback: true };
        }

        const transport = new StdioClientTransport({
            command: "npx",
            args: ["-y", "xactions-mcp"],
            env: {
                ...process.env,
                XACTIONS_SESSION_COOKIE: sessionCookie
            }
        });

        const client = new Client({
            name: "fud-ai-twitter-client",
            version: "1.0.0"
        }, {
            capabilities: {}
        });

        await client.connect(transport);
        
        // Timeout for MCP tool call
        const resultPromise = client.callTool({
            name: "x_search_tweets",
            arguments: {
                query: `${coinSymbol} crypto`,
                limit: 10
            }
        });

        // Add a 10-second timeout to prevent stalling the pipeline
        const result = await Promise.race([
            resultPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Twitter MCP timeout")), 10000))
        ]) as any;

        // Cleanup
        await transport.close();

        const content = result.content?.[0]?.text || "";
        return {
            text: content || "No recent relevant tweets found.",
            fallback: false
        };
    } catch (error) {
        console.error(`[Ingestion Error] fetchTwitterIntel failed for ${coinSymbol}:`, error);
        return { text: "No social data available", fallback: true };
    }
}

export async function fetchTelegramIntel(coinSymbol: string) {
    try {
        const appId = process.env.TG_APP_ID;
        const apiHash = process.env.TG_API_HASH;
        
        if (!appId || !apiHash) {
            console.warn("[Ingestion Warning] TG_APP_ID or TG_API_HASH is missing. Returning fallback.");
            return { text: "No social data available", fallback: true };
        }

        const transport = new StdioClientTransport({
            command: "npx",
            args: ["-y", "@chaindead/telegram-mcp"],
            env: {
                ...process.env,
                TG_APP_ID: appId,
                TG_API_HASH: apiHash
            }
        });

        const client = new Client({
            name: "fud-ai-telegram-client",
            version: "1.0.0"
        }, {
            capabilities: {}
        });

        await client.connect(transport);
        
        // Timeout for MCP tool call
        const resultPromise = client.callTool({
            name: "tg_dialogs",
            arguments: {
                query: coinSymbol,
                limit: 10
            }
        });

        // Add a 10-second timeout to prevent stalling the pipeline
        const result = await Promise.race([
            resultPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Telegram MCP timeout")), 10000))
        ]) as any;

        // Cleanup
        await transport.close();

        const content = result.content?.[0]?.text || "";
        return {
            text: content || "No recent relevant messages found.",
            fallback: false
        };
    } catch (error) {
        console.error(`[Ingestion Error] fetchTelegramIntel failed for ${coinSymbol}:`, error);
        return { text: "No social data available", fallback: true };
    }
}
