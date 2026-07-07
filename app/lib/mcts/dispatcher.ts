import { runHeavyweightEngine } from '../llm/engines';

export const REGISTRY_SCHEMA = {
  bybit_v5: { 
    endpoints: { 
      "/v5/market/orderbook": ["a (asks)", "b (bids)"], 
      "/v5/market/tickers": ["lastPrice", "price24hPcnt", "volume24h", "bid1Price", "ask1Price"] 
    } 
  },
  goplus: { 
    endpoints: { 
      "/api/v1/token_security": ["is_open_source", "is_proxy", "is_mintable", "owner_address", "hidden_owner", "is_honeypot", "buy_tax", "sell_tax", "holder_count", "is_anti_whale"] 
    } 
  },
  rugcheck: { 
    endpoints: { 
      "/v1/tokens/{mint}/report": ["score", "rugged", "risks", "totalMarketLiquidity", "topHolders"] 
    } 
  },
  dexscreener: { 
    endpoints: { 
      "/latest/dex/pairs/{chainId}/{pairId}": ["priceUsd", "txns.h24", "volume.h24", "priceChange.h24", "liquidity.usd", "fdv", "marketCap"] 
    } 
  },
  defillama: { 
    endpoints: { 
      "/protocols": ["tvl", "change_1d", "change_7d"] 
    } 
  },
  coingecko: {
    endpoints: {
      "/coins/markets": ["current_price", "market_cap", "total_volume", "price_change_percentage_24h"],
      "/coins/{id}": ["community_data", "developer_data"]
    }
  },
  social_rapidapi_twitter: {
    tools: ["search_tweets"]
  },
  social_telegram: {
    tools: ["scan_channels"]
  }
};

export interface ClientRequest {
  coinSymbol: string;
  contractAddress?: string;
  chainId?: string;
}

export interface DispatcherStrategy {
  bybit_v5?: {
    endpoints: {
      "/v5/market/orderbook"?: ("a (asks)" | "b (bids)")[];
      "/v5/market/tickers"?: ("lastPrice" | "price24hPcnt" | "volume24h" | "bid1Price" | "ask1Price")[];
    };
  };
  goplus?: {
    endpoints: {
      "/api/v1/token_security"?: ("is_open_source" | "is_proxy" | "is_mintable" | "owner_address" | "hidden_owner" | "is_honeypot" | "buy_tax" | "sell_tax" | "holder_count" | "is_anti_whale")[];
    };
  };
  rugcheck?: {
    endpoints: {
      "/v1/tokens/{mint}/report"?: ("score" | "rugged" | "risks" | "totalMarketLiquidity" | "topHolders")[];
    };
  };
  dexscreener?: {
    endpoints: {
      "/latest/dex/pairs/{chainId}/{pairId}"?: ("priceUsd" | "txns.h24" | "volume.h24" | "priceChange.h24" | "liquidity.usd" | "fdv" | "marketCap")[];
    };
  };
  defillama?: {
    endpoints: {
      "/protocols"?: ("tvl" | "change_1d" | "change_7d")[];
    };
  };
  coingecko?: {
    endpoints: {
      "/coins/markets"?: ("current_price" | "market_cap" | "total_volume" | "price_change_percentage_24h")[];
      "/coins/{id}"?: ("community_data" | "developer_data")[];
    };
  };
  social_rapidapi_twitter?: {
    tools: "search_tweets"[];
  };
  social_telegram?: {
    tools: "scan_channels"[];
  };
}

const DISPATCHER_SYSTEM_PROMPT = `You are a granular data routing dispatcher for FUD.ai.
Analyze the user request for a token and determine which API endpoints and specific fields, or social-scraper tools, are required to inspect the safety, liquidity, and FUD claims surrounding the token.

You MUST respond with a single valid JSON object only representing the chosen strategy.
Do NOT wrap the output in markdown code blocks like \`\`\`json. Return only the raw JSON.
The structure of your output must be a subset of the REGISTRY_SCHEMA. If an endpoint/tool is not needed, do not include it.

Here is the REGISTRY_SCHEMA:
${JSON.stringify(REGISTRY_SCHEMA, null, 2)}

CRITICAL — CHAIN COMPATIBILITY CONSTRAINTS (applied before selecting endpoints):
- "goplus" (token_security) is EVM-ONLY. It works exclusively on EVM-compatible chains (Ethereum=1, BSC=56, Polygon=137, Arbitrum=42161, Base=8453, Avalanche=43114, Optimism=10, etc.). It does NOT support Solana, Bitcoin, Tron, or any non-EVM chain. If the Chain ID in the request is not a recognized EVM chainId, you MUST OMIT "goplus" entirely — never include it for Solana tokens (mint addresses), Bitcoin, or other non-EVM assets. For Solana tokens use "rugcheck" instead.
- "bybit_v5" (/v5/market/tickers, /v5/market/orderbook) is a centralized-exchange (CEX) market-data API that only lists major spot/perpetual tickers (e.g. BTCUSDT, ETHUSDT). It does NOT track long-tail DEX/meme tokens, native L1 assets without a Bybit listing, or arbitrary contract addresses. If the token is unlikely to have a Bybit listing (e.g. a fresh pump.fun meme coin, a micro-cap DEX-only token, or a non-tradable asset), OMIT "bybit_v5".
- "rugcheck" (/v1/tokens/{mint}/report) is Solana-ONLY. Use it when the contract address is a Solana mint. Do NOT request it for EVM contract addresses (0x...) or BTC — it will 404.
- "dexscreener", "defillama", and "coingecko" are chain-agnostic and safe to request for the vast majority of tokens.
- "social_rapidapi_twitter" and "social_telegram" are native ingestion handlers (no MCP). They are chain-agnostic and should be included whenever sentiment / FUD-chatter analysis is desired around the token. For meme / low-cap tokens they are usually the strongest signal — prefer including them. For pure-utility / stablecoin requests they can be omitted to save latency.

Cross-check the Chain ID / address format before deciding:
- EVM → addresses start with "0x" (40 hex chars after 0x); use "goplus", optionally "dexscreener", "coingecko".
- Solana → base58 mint (~32-44 chars, no 0x prefix); use "rugcheck" and "dexscreener", NOT "goplus".
- Bitcoin / native assets → no contract address; skip both "goplus" and "rugcheck", rely on "bybit_v5" (if listed), "coingecko", "defillama".

Provide the strategy selection JSON object. Avoid fetching redundant data. Select only what is highly relevant for the coin/contract in the request.
Example output format:
{
  "bybit_v5": {
    "endpoints": {
      "/v5/market/orderbook": ["a (asks)", "b (bids)"]
    }
  },
  "goplus": {
    "endpoints": {
      "/api/v1/token_security": ["is_honeypot", "is_mintable", "is_open_source"]
    }
  },
  "social_rapidapi_twitter": {
    "tools": ["search_tweets"]
  }
}`;

export async function runGranularDispatcher(clientRequest: ClientRequest): Promise<DispatcherStrategy> {
  const userPrompt = `CLIENT REQUEST:
Coin Symbol: ${clientRequest.coinSymbol}
Contract Address: ${clientRequest.contractAddress || 'none'}
Chain ID: ${clientRequest.chainId || '1'}`;

  const geminiApiKey = process.env.GEMINI_API_KEY;

  // Primary: Gemini 2.5 Flash via Gemini API
  if (geminiApiKey) {
    try {
      console.log("🤖 [Dispatcher] Querying Gemini 2.5 Flash as primary LLM...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: userPrompt }
              ]
            }
          ],
          systemInstruction: {
            parts: [
              { text: DISPATCHER_SYSTEM_PROMPT }
            ]
          },
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          const parsed = JSON.parse(content.trim());
          return parsed as DispatcherStrategy;
        }
      } else {
        console.warn(`[Dispatcher Warning] Gemini Primary returned status ${response.status}. Trying fallback...`);
      }
    } catch (error) {
      console.error("[Dispatcher Error] Gemini Primary failed. Trying fallback...", error);
    }
  } else {
    console.warn("[Dispatcher Warning] GEMINI_API_KEY is missing. Trying fallback...");
  }

  // Fallback: DeepSeek v4 Flash via DeepSeek API
  try {
    console.log("🤖 [Dispatcher] Querying DeepSeek v4 Flash as fallback LLM...");
    const result = await runHeavyweightEngine(DISPATCHER_SYSTEM_PROMPT, userPrompt);
    // Extract content string from HeavyweightResult
    const raw = result.content;
    // Strip markdown formatting if any
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const parsed = JSON.parse(cleaned);
    return parsed as DispatcherStrategy;
  } catch (error) {
    console.error("[Dispatcher Error] DeepSeek Fallback failed:", error);
  }

  // Safe empty strategy fallback if everything fails
  return {};
}
