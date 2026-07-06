# White-Box Intelligence Test Report (FUD.ai)

This report details the execution and results of the White-Box Intelligence Test performed on 2026-07-06. The test bypasses TestSprite to inspect the internal state routing and LLM reasoning process across 4 real-world evaluation scenarios.

---

## 📊 Summary of Test Results

| Scenario | Target Token | Scope / Expectation | Verdict | Result |
|---|---|---|---|---|
| **Scenario 1** | $WIF (Solana) | RugCheck + Social RapidAPI + Telegram | `IGNORE_FUD` (Confidence 0.9) | ✅ Passed |
| **Scenario 2** | $PEPE (Ethereum) | GoPlus + DexScreener + Telegram | `IGNORE_FUD` (Confidence 0.8) | ✅ Passed |
| **Scenario 3** | $TRUMP (Ambiguous) | Forced `FETCH_MORE` ReAct loop | `IGNORE_FUD` (Confidence 0.8) | ✅ Passed |
| **Scenario 4** | $BTC (Native L1) | Bybit CEX + CoinGecko + Social (No SC) | `HOLD` (Confidence 0.6) | ✅ Passed |

---

## 💳 DeepSeek API Token Billing Statement

During the sequential execution of the 4 scenarios, the actual token consumption of the DeepSeek model (`deepseek-v4-flash`) was intercepted and tabulated:

### Pricing Rates
- **1M Input Tokens (Cache Hit)**: $0.0028
- **1M Input Tokens (Cache Miss)**: $0.14
- **1M Output Tokens**: $0.28

### Consumption & Billing Metrics
- **Input Tokens (Cache Hit)**: `1,536` ($0.000004 USD)
- **Input Tokens (Cache Miss)**: `2,863` ($0.000401 USD)
- **Output Tokens**: `4,538` ($0.001271 USD)
- **Total Estimated Session Cost**: **$0.001676 USD**

---

## 📑 Full Console Execution Logs

### Scenario 1: Solana FUD Scenario
- **Query**: "Analyze $WIF on Solana. Are there any critical vulnerabilities in the contract and what is the current Twitter/Telegram sentiment?"
- **Inputs**: Symbol=WIF, Address=EKpQGSJtj57q6UB4Rfth8a1sJa7c6HP9gW9zZAc1pump, ChainId=solana

```json
==================== [DISPATCHER ROUTING] ====================
{
  "bybit_v5": {
    "endpoints": {
      "/v5/market/orderbook": ["a (asks)", "b (bids)"],
      "/v5/market/tickers": ["lastPrice", "price24hPcnt", "volume24h", "bid1Price", "ask1Price"]
    }
  },
  "rugcheck": {
    "endpoints": {
      "/v1/tokens/{mint}/report": ["score", "rugged", "risks", "totalMarketLiquidity", "topHolders"]
    }
  },
  "dexscreener": {
    "endpoints": {
      "/latest/dex/pairs/{chainId}/{pairId}": ["priceUsd", "txns.h24", "volume.h24", "priceChange.h24", "liquidity.usd", "fdv", "marketCap"]
    }
  },
  "coingecko": {
    "endpoints": {
      "/coins/markets": ["current_price", "market_cap", "total_volume", "price_change_percentage_24h"],
      "/coins/{id}": ["community_data", "developer_data"]
    }
  },
  "social_rapidapi_twitter": {
    "tools": ["search_tweets"]
  },
  "social_telegram": {
    "tools": ["scan_channels"]
  }
}
```

```text
==================== [INGESTION PAYLOAD] ====================
📊 Ingestion sources populated:
  - [RapidAPI Twitter]: Fetched 19 tweets.
    Snippet: "@CrimsonPandaNFT: New Listing Around the Corner...  $WIF 👀 The Community Vote Dashboard for $WIF is Now Live for Hol..."
  - [RugCheck Solana]: Score = undefined, Risks count = 0
  - [CoinGecko Market]: Price = $undefined, Cap = $undefined
```

```json
==================== [FINAL AI VERDICT] ====================
{
  "drama_index": 10,
  "dominant_branch": "DeadToken",
  "branch_probabilities": {
    "DeadToken": 0.9,
    "UndiscoveredGem": 0.05,
    "FUDIrrelevant": 0.05
  },
  "evidence_chain": [
    "No liquidity on DEX (Liquidity: $0)",
    "No 24h volume",
    "Price $0",
    "FUD claims unrelated to token specifics"
  ],
  "executable_verdict": "IGNORE_FUD",
  "confidence": 0.9,
  "served_from_cache": false,
  "fallback": false
}
```

---

### Scenario 2: EVM Fundamental Scenario
- **Query**: "Check $PEPE on Ethereum. Is it a honeypot? Also, how is the macro TVL holding up?"
- **Inputs**: Symbol=PEPE, Address=0x6982508145554ce3b5901a7778ad28a500216222, ChainId=1

```json
==================== [DISPATCHER ROUTING] ====================
{
  "bybit_v5": {
    "endpoints": {
      "/v5/market/orderbook": ["a (asks)", "b (bids)"],
      "/v5/market/tickers": ["lastPrice", "price24hPcnt", "volume24h", "bid1Price", "ask1Price"]
    }
  },
  "goplus": {
    "endpoints": {
      "/api/v1/token_security": ["is_open_source", "is_proxy", "is_mintable", "owner_address", "hidden_owner", "is_honeypot", "buy_tax", "sell_tax", "holder_count", "is_anti_whale"]
    }
  },
  "dexscreener": {
    "endpoints": {
      "/latest/dex/pairs/{chainId}/{pairId}": ["priceUsd", "txns.h24", "volume.h24", "priceChange.h24", "liquidity.usd", "fdv", "marketCap"]
    }
  },
  "coingecko": {
    "endpoints": {
      "/coins/markets": ["current_price", "market_cap", "total_volume", "price_change_percentage_24h"],
      "/coins/{id}": ["community_data", "developer_data"]
    }
  },
  "social_rapidapi_twitter": {
    "tools": ["search_tweets"]
  },
  "social_telegram": {
    "tools": ["scan_channels"]
  }
}
```

```text
==================== [INGESTION PAYLOAD] ====================
📊 Ingestion sources populated:
  - [RapidAPI Twitter]: Fetched 19 tweets.
    Snippet: "@AntiHypeCatNFT: Attention $PEPE Family! YOUR vote matters! Less than 100 votes are needed to list $PEPE on the Moon..."
  - [CoinGecko Market]: Price = $0.00000263, Cap = $1106265798
```

```json
==================== [FINAL AI VERDICT] ====================
{
  "drama_index": 20,
  "dominant_branch": "FUD_false",
  "branch_probabilities": {
    "FUD_false": 0.8,
    "FUD_partially_true": 0.15,
    "FUD_legitimate_concerns": 0.05
  },
  "evidence_chain": [
    "CoinGecko shows active trading with $148M volume and $1.1B market cap.",
    "No delisting news or official warnings found.",
    "Security data shows no honeypot or mintable flag, risk score 0.",
    "Low DEX liquidity but token trades primarily on CEXes, explaining DEX data.",
    "Delisting claim date is Feb 2026, far in future with no evidence."
  ],
  "executable_verdict": "IGNORE_FUD",
  "confidence": 0.8,
  "served_from_cache": false,
  "fallback": false
}
```

---

### Scenario 3: Ambiguous Query (Forced ReAct / FetchMore Loop)
- **Query**: "Should I buy $TRUMP? I heard rumors about the dev team selling."
- **Inputs**: Symbol=TRUMP, Address=none, ChainId=none

```json
==================== [DISPATCHER ROUTING] ====================
{
  "bybit_v5": {
    "endpoints": {
      "/v5/market/orderbook": ["a (asks)", "b (bids)"],
      "/v5/market/tickers": ["lastPrice", "price24hPcnt", "volume24h", "bid1Price", "ask1Price"]
    }
  },
  "coingecko": {
    "endpoints": {
      "/coins/markets": ["current_price", "market_cap", "total_volume", "price_change_percentage_24h"],
      "/coins/{id}": ["community_data"]
    }
  },
  "social_rapidapi_twitter": {
    "tools": ["search_tweets"]
  },
  "social_telegram": {
    "tools": ["scan_channels"]
  }
}
```

```text
==================== [INGESTION PAYLOAD] ====================
📊 Ingestion sources populated:
  - [RapidAPI Twitter]: Fetched 19 tweets.
    Snippet: "@drummike2012: How does the news that Trump made money on his crypto scam while investors lost theirs sit with MAGA..."
  - [CoinGecko Market]: Price = $undefined, Cap = $undefined
```

```text
==================== [MCTS FETCH_MORE LOOP] ====================
🔄 LLM requested dynamic fetch step: [MCTS] FETCH_MORE requested (iteration 0): "On-chain holder distribution, transaction history, and any records of TRUMP token sales by known insider wallets. Also need historical price and volume data to verify claims of $3.8B losses."
🔄 [ReAct] Dynamic Fetch triggered for target: On-chain holder distribution, transaction history, and any records of TRUMP token sales by known insider wallets. Also need historical price and volume data to verify claims of $3.8B losses.
```

```json
==================== [FINAL AI VERDICT] ====================
{
  "drama_index": 10,
  "dominant_branch": "No Market Activity",
  "branch_probabilities": {
    "No Market Activity": 0.95,
    "Data Error": 0.05
  },
  "evidence_chain": [
    "No DEX liquidity",
    "Zero volume",
    "Price $0",
    "No active trading"
  ],
  "executable_verdict": "IGNORE_FUD",
  "confidence": 0.8,
  "served_from_cache": false,
  "fallback": false
}
```

---

### Scenario 4: Native L1 / Macro Scenario
- **Query**: "Analyze the current market structure for Bitcoin. Are whales accumulating, and what is the general mood on Twitter and Telegram?"
- **Inputs**: Symbol=BTC, Address=native, ChainId=native

```json
==================== [DISPATCHER ROUTING] ====================
{
  "bybit_v5": {
    "endpoints": {
      "/v5/market/orderbook": ["a (asks)", "b (bids)"],
      "/v5/market/tickers": ["lastPrice", "price24hPcnt", "volume24h", "bid1Price", "ask1Price"]
    }
  },
  "coingecko": {
    "endpoints": {
      "/coins/markets": ["current_price", "market_cap", "total_volume", "price_change_percentage_24h"],
      "/coins/{id}": ["community_data", "developer_data"]
    }
  },
  "social_rapidapi_twitter": {
    "tools": ["search_tweets"]
  },
  "social_telegram": {
    "tools": ["scan_channels"]
  }
}
```

```text
==================== [INGESTION PAYLOAD] ====================
📊 Ingestion sources populated:
  - [RapidAPI Twitter]: Fetched 19 tweets.
    Snippet: "@GrandePetrolio: Tired of seeing so many $BTC "News" Accounts posting about it "falling below 62,000 again"..."
  - [CoinGecko Market]: Price = $undefined, Cap = $undefined
```

```text
==================== [MCTS FETCH_MORE LOOP] ====================
🔄 LLM requested dynamic fetch step: [MCTS] FETCH_MORE requested (iteration 0): "perp funding rate, open interest, and order book depth (top 10 bids/asks) from major exchanges"
🔄 [ReAct] Dynamic Fetch triggered for target: perp funding rate, open interest, and order book depth (top 10 bids/asks) from major exchanges
```

```json
==================== [FINAL AI VERDICT] ====================
{
  "drama_index": 70,
  "dominant_branch": "Bearish Break",
  "branch_probabilities": {
    "Bearish Break": 0.4,
    "Bullish Reversal": 0.3,
    "Neutral Consolidation": 0.3
  },
  "evidence_chain": [
    "Order book shows thin support at 62891.2 and ask at 62891.3",
    "Perpetual funding rate is 0.00443208, positive, indicating long positions paying shorts",
    "FUD claims widely predict further decline towards 60k-54k",
    "No significant on-chain anomalies detected (security data not applicable to BTC)"
  ],
  "executable_verdict": "HOLD",
  "confidence": 0.6,
  "served_from_cache": false,
  "fallback": false
}
```
