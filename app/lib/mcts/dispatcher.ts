/**
 * dispatcher.ts — Granular data routing dispatcher for FUD.ai.
 *
 * CRITICAL-01 fix: fetch() in the Gemini primary path replaced with
 *   fetchWithTimeout() (30s for LLM inference).
 * CRITICAL-03 fix: LLM JSON output is now validated against DispatcherStrategySchema
 *   before being used as a DispatcherStrategy. On validation failure, a full
 *   default strategy (all sources) is returned so no data source is silently skipped
 *   due to a malformed dispatcher response.
 */

import { z } from 'zod';
import { runHeavyweightEngine } from '../llm/engines';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

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

// ─────────────────────────────────────────────────────────────
// CRITICAL-03: Zod schema for validating dispatcher LLM output
// ─────────────────────────────────────────────────────────────

const DispatcherStrategySchema = z.object({
  bybit_v5: z.object({
    endpoints: z.object({
      "/v5/market/orderbook": z.array(z.string()).optional(),
      "/v5/market/tickers": z.array(z.string()).optional(),
    }),
  }).optional(),
  goplus: z.object({
    endpoints: z.object({
      "/api/v1/token_security": z.array(z.string()).optional(),
    }),
  }).optional(),
  rugcheck: z.object({
    endpoints: z.object({
      "/v1/tokens/{mint}/report": z.array(z.string()).optional(),
    }),
  }).optional(),
  dexscreener: z.object({
    endpoints: z.object({
      "/latest/dex/pairs/{chainId}/{pairId}": z.array(z.string()).optional(),
    }),
  }).optional(),
  defillama: z.object({
    endpoints: z.object({
      "/protocols": z.array(z.string()).optional(),
    }),
  }).optional(),
  coingecko: z.object({
    endpoints: z.object({
      "/coins/markets": z.array(z.string()).optional(),
      "/coins/{id}": z.array(z.string()).optional(),
    }),
  }).optional(),
  social_rapidapi_twitter: z.object({
    tools: z.array(z.string()),
  }).optional(),
  social_telegram: z.object({
    tools: z.array(z.string()),
  }).optional(),
}).passthrough(); // allow unknown keys to not throw, they'll just be ignored

/**
 * The full default strategy — all major sources enabled.
 * Used as a safe fallback when the dispatcher LLM output fails Zod validation.
 * This ensures no data source is silently skipped due to a malformed response.
 */
const DEFAULT_STRATEGY: DispatcherStrategy = {
  bybit_v5: {
    endpoints: {
      "/v5/market/orderbook": ["a (asks)", "b (bids)"],
      "/v5/market/tickers": ["lastPrice", "price24hPcnt", "volume24h", "bid1Price", "ask1Price"],
    },
  },
  dexscreener: {
    endpoints: {
      "/latest/dex/pairs/{chainId}/{pairId}": ["priceUsd", "txns.h24", "volume.h24", "priceChange.h24", "liquidity.usd", "fdv", "marketCap"],
    },
  },
  coingecko: {
    endpoints: {
      "/coins/markets": ["current_price", "market_cap", "total_volume", "price_change_percentage_24h"],
    },
  },
  defillama: {
    endpoints: {
      "/protocols": ["tvl", "change_1d", "change_7d"],
    },
  },
  social_rapidapi_twitter: { tools: ["search_tweets"] },
  social_telegram: { tools: ["scan_channels"] },
};

/**
 * Unifies JSON extraction logic by stripping markdown fences and searching backwards
 * for a valid JSON block (MEDIUM-04).
 */
function extractJsonFromLLMOutput(raw: string): any {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    return JSON.parse(cleaned);
  } catch {
    let idx = raw.lastIndexOf('{');
    while (idx >= 0) {
      const candidate = raw.slice(idx).trim().replace(/\s*```\s*$/, '');
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch {
        // Continue searching backwards
      }
      idx = raw.lastIndexOf('{', idx - 1);
    }

    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Validates a raw LLM-parsed object against DispatcherStrategySchema.
 * On failure: logs the validation errors and returns DEFAULT_STRATEGY so that
 * all ingestion sources remain enabled (no silent skip).
 */
function validateStrategy(raw: unknown): DispatcherStrategy {
  const result = DispatcherStrategySchema.safeParse(raw);
  if (result.success) {
    return result.data as DispatcherStrategy;
  }

  console.warn(
    '[Dispatcher] LLM output failed Zod schema validation — falling back to DEFAULT_STRATEGY.',
    'Validation errors:',
    result.error.flatten()
  );
  return DEFAULT_STRATEGY;
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

  // Primary: DeepSeek v4 Flash via Heavyweight Engine
  try {
    console.log("🤖 [Dispatcher] Querying DeepSeek as primary LLM...");
    const result = await runHeavyweightEngine(DISPATCHER_SYSTEM_PROMPT, userPrompt);
    const parsed = extractJsonFromLLMOutput(result.content);
    // CRITICAL-03: validate schema before returning
    return validateStrategy(parsed);
  } catch (error) {
    console.warn("[Dispatcher Warning] DeepSeek Primary failed. Trying fallback...", error);
  }

  // Fallback: Gemini 2.5 Flash via Gemini API
  // CRITICAL-01: uses fetchWithTimeout (30s for LLM inference)
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      console.log("🤖 [Dispatcher] Querying Gemini 2.5 Flash as fallback LLM...");
      const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
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
        },
        30_000 // 30s for LLM inference
      );

      if (response.ok) {
        const data = await response.json();
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          const parsed = extractJsonFromLLMOutput(content);
          // CRITICAL-03: validate schema before returning
          return validateStrategy(parsed);
        }
      } else {
        console.warn(`[Dispatcher Warning] Gemini Fallback returned status ${response.status}.`);
      }
    } catch (error) {
      console.error("[Dispatcher Error] Gemini Fallback failed:", error);
    }
  } else {
    console.warn("[Dispatcher Warning] GEMINI_API_KEY is missing, skipping Gemini fallback.");
  }

  // Safe empty strategy fallback if everything fails — validateStrategy will upgrade to DEFAULT_STRATEGY
  return validateStrategy({});
}
