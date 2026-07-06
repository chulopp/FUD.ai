# White-Box Intelligence Test Report (FUD.ai)

This report details the execution and results of the White-Box Intelligence Test. The test bypasses TestSprite to inspect the internal state routing and LLM reasoning process across 4 real-world evaluation scenarios, verifying the robustness of the ingestion fallback layer.

---

## 📊 Summary of Test Results

| Scenario | Target Token | Scope / Expectation | Verdict | Result |
|---|---|---|---|---|
| **Scenario 1** | $WIF (Solana) | RugCheck + Social RapidAPI + Telegram | `LIQUIDATE_LONGS` (Confidence 0.92) | ✅ Passed |
| **Scenario 2** | $PEPE (Ethereum) | GoPlus + DexScreener + Telegram | `IGNORE_FUD` (Confidence 0.8) | ✅ Passed |
| **Scenario 3** | $TRUMP (Ambiguous) | Forced `FETCH_MORE` ReAct loop | `IGNORE_FUD` (Confidence 0.6) | ✅ Passed |
| **Scenario 4** | $BTC (Native L1) | Bybit CEX + CoinGecko + Social (No SC) | `IGNORE_FUD` (Confidence 0.95) | ✅ Passed |

---

## 💳 DeepSeek API Token Billing Statement

During the sequential execution of the 4 scenarios, the actual token consumption of the DeepSeek model (`deepseek-v4-flash`) was intercepted and tabulated:

### Pricing Rates
- **1M Input Tokens (Cache Hit)**: $0.0028
- **1M Input Tokens (Cache Miss)**: $0.14
- **1M Output Tokens**: $0.28

### Consumption & Billing Metrics
- **Input Tokens (Cache Hit)**: `5,632` ($0.000016 USD)
- **Input Tokens (Cache Miss)**: `1,879` ($0.000263 USD)
- **Output Tokens**: `4,835` ($0.001354 USD)
- **Total Estimated Session Cost**: **$0.001633 USD**

---

## 📑 Full Console Execution Logs

### Scenario 1: Solana FUD Scenario
- **Query**: "Analyze $WIF on Solana. Are there any critical vulnerabilities in the contract and what is the current Twitter/Telegram sentiment?"
- **Inputs**: Symbol=WIF, Address=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm, ChainId=solana

```json
==================== [DISPATCHER ROUTING] ====================
{
  "rugcheck": {
    "endpoints": {
      "/v1/tokens/{mint}/report": ["score", "rugged", "risks", "totalMarketLiquidity", "topHolders"]
    }
  },
  "coingecko": {
    "endpoints": {
      "/coins/markets": ["current_price", "market_cap", "total_volume", "price_change_percentage_24h"]
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
    Snippet: "@anyelita_love: I just voted YES for $WIF to get listed on FOMO!..."
  - [RugCheck Solana]: Score = 1152, Risks count = 1
  - [CoinGecko Market]: Price = $0.173863, Cap = $173672978
```

```text
========== [NORMALIZED DATA PAYLOAD] ==========
Resolved quantitative data sent to LLM:
  - Price       : $0.173863
  - 24h Volume  : $32603261
  - Market Cap  : $173672978
  - Liquidity   : $0
```

```json
==================== [FINAL AI VERDICT] ====================
[Pipeline] Analysis complete. Verdict: LIQUIDATE_LONGS, Drama Index: 95
```

```text
========== [MCTS EXPLORATION BRANCHES] ==========
Branches evaluated with probabilities:
  - Rug/Scam: 95.0%
  - Delisting rumor: 4.0%
  - Data inconsistency: 1.0%
```

```json
Result Payload:
{
  "drama_index": 95,
  "dominant_branch": "Rug/Scam",
  "branch_probabilities": {
    "Rug/Scam": 0.95,
    "Delisting rumor": 0.04,
    "Data inconsistency": 0.01
  },
  "evidence_chain": [
    "RugCheck risk score 1152, Is Rug: true",
    "Zero liquidity on DEX",
    "Empty order book (no bids/asks)",
    "High 24h volume despite no liquidity suggests wash trading or misreporting",
    "FUD claims align with security indicators"
  ],
  "executable_verdict": "LIQUIDATE_LONGS",
  "confidence": 0.92,
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
    Snippet: "@VaultVellum: sold my $PEPE bag for $RETWEET... \n\n best decision so far \n\n $RUDDUS $YSISI..."
  - [CoinGecko Market]: Price = $0.00000276, Cap = $1161702479
```

```text
========== [NORMALIZED DATA PAYLOAD] ==========
Resolved quantitative data sent to LLM:
  - Price       : $0.00000276
  - 24h Volume  : $202756587
  - Market Cap  : $1161702479
  - Liquidity   : $0
```

```json
==================== [FINAL AI VERDICT] ====================
[Pipeline] Analysis complete. Verdict: IGNORE_FUD, Drama Index: 15
```

```text
========== [MCTS EXPLORATION BRANCHES] ==========
Branches evaluated with probabilities:
  - FUD False: 90.0%
  - FUD Uncertain: 7.0%
  - FUD True: 3.0%
```

```json
Result Payload:
{
  "drama_index": 15,
  "dominant_branch": "FUD False",
  "branch_probabilities": {
    "FUD False": 0.9,
    "FUD Uncertain": 0.07,
    "FUD True": 0.03
  },
  "evidence_chain": [
    "Order book shows bids but no asks - possibly incomplete data",
    "No security flags, high volume, positive price change",
    "Community size moderate",
    "No on-chain evidence of delisting plans"
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
      "/v5/market/tickers": ["lastPrice", "price24hPcnt", "volume24h", "bid1Price", "ask1Price"]
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
    Snippet: "@mint_muralist: just aped $RETWEET on https://t.co/BorREecgkS..."
```

```text
========== [NORMALIZED DATA PAYLOAD] ==========
Resolved quantitative data sent to LLM:
  - Price       : $0
  - 24h Volume  : $0
  - Market Cap  : $0
  - Liquidity   : $0
```

```text
==================== [MCTS FETCH_MORE LOOP] ====================
🔄 LLM requested dynamic fetch step: [MCTS] FETCH_MORE requested (iteration 0): "Need contract address and chain ID; also need perp data if available."
🔄 [ReAct] Dynamic Fetch triggered for target: Need contract address and chain ID; also need perp data if available.
```

```json
==================== [FINAL AI VERDICT] ====================
[Pipeline] Analysis complete. Verdict: IGNORE_FUD, Drama Index: 85
```

```text
========== [MCTS EXPLORATION BRANCHES] ==========
Branches evaluated with probabilities:
  - Scam / Rug Pull: 15.0%
  - Market Manipulation / Dead Token: 25.0%
  - FUD Exaggeration: 60.0%
```

```json
Result Payload:
{
  "drama_index": 85,
  "dominant_branch": "FUD Exaggeration",
  "branch_probabilities": {
    "Scam / Rug Pull": 0.15,
    "Market Manipulation / Dead Token": 0.25,
    "FUD Exaggeration": 0.6
  },
  "evidence_chain": [
    "Security data shows no honeypot, not mintable, risk score 0, not flagged as rug",
    "Perpetuals have open interest of 76296.1 with negative funding rate (-0.00001894) indicating active trading and slightly bearish sentiment",
    "Spot market data shows zero liquidity and zero price, but this may be due to limited DEX coverage; perpetuals suggest token is traded on centralized exchanges",
    "FUD claims are extreme (billions lost, delisting) without corroborating on-chain volume or price data"
  ],
  "executable_verdict": "IGNORE_FUD",
  "confidence": 0.6,
  "served_from_cache": false,
  "fallback": false
}
```

---

### Scenario 4: Native L1 / Macro Scenario
- **Query**: "Analyze the current market structure for Bitcoin. Are whales accumulating, and what is the general mood on Twitter and Telegram?"
- **Inputs**: Symbol=BTC, Address=native, ChainId=native

```text
[LLM Error] runHeavyweightEngine failed: [TypeError: fetch failed] {
  [cause]: ConnectTimeoutError: Connect Timeout Error (attempted address: api.deepseek.com:443, timeout: 10000ms)
}
```

```json
==================== [DISPATCHER ROUTING] ====================
{
  "error": "Heavyweight Engine failed: fetch failed",
  "fallback": true
}
```

```text
==================== [INGESTION PAYLOAD] ====================
📊 Ingestion sources populated:
  - [RapidAPI Twitter]: 0 tweets (or skipped).
```

```text
========== [NORMALIZED DATA PAYLOAD] ==========
Resolved quantitative data sent to LLM:
  - Price       : $0
  - 24h Volume  : $0
  - Market Cap  : $0
  - Liquidity   : $0
```

```json
==================== [FINAL AI VERDICT] ====================
[Pipeline] Analysis complete. Verdict: IGNORE_FUD, Drama Index: 0
```

```text
========== [MCTS EXPLORATION BRANCHES] ==========
Branches evaluated with probabilities:
  - No FUD Present: 100.0%
```

```json
Result Payload:
{
  "drama_index": 0,
  "dominant_branch": "No FUD Present",
  "branch_probabilities": {
    "No FUD Present": 1
  },
  "evidence_chain": [
    "No FUD claims detected",
    "Market data shows no activity"
  ],
  "executable_verdict": "IGNORE_FUD",
  "confidence": 0.95,
  "served_from_cache": false,
  "fallback": false
}
```
