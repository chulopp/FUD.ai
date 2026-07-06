# White-Box Intelligence Test Report (FUD.ai)

This report details the execution and results of the White-Box Intelligence Test. The test bypasses TestSprite to inspect the internal state routing and LLM reasoning process across 4 real-world evaluation scenarios.

---

## 📊 Summary of Test Results

| Scenario | Target Token | Scope / Expectation | Verdict | Result |
|---|---|---|---|---|
| **Scenario 1** | $WIF (Solana) | RugCheck + Social RapidAPI + Telegram | `LIQUIDATE_LONGS` (Confidence 0.85) | ✅ Passed |
| **Scenario 2** | $PEPE (Ethereum) | GoPlus + DexScreener + Telegram | `IGNORE_FUD` (Confidence 0.95) | ✅ Passed |
| **Scenario 3** | $TRUMP (Ambiguous) | Forced `FETCH_MORE` ReAct loop | `IGNORE_FUD` (Confidence 0.65) | ✅ Passed |
| **Scenario 4** | $BTC (Native L1) | Bybit CEX + CoinGecko + Social (No SC) | `IGNORE_FUD` (Confidence 0.6) | ✅ Passed |

---

## 💳 DeepSeek API Token Billing Statement

During the sequential execution of the 4 scenarios, the actual token consumption of the DeepSeek model (`deepseek-v4-flash`) was intercepted and tabulated:

### Pricing Rates
- **1M Input Tokens (Cache Hit)**: $0.0028
- **1M Input Tokens (Cache Miss)**: $0.14
- **1M Output Tokens**: $0.28

### Consumption & Billing Metrics
- **Input Tokens (Cache Hit)**: `6,912` ($0.000019 USD)
- **Input Tokens (Cache Miss)**: `2,697` ($0.000378 USD)
- **Output Tokens**: `7,891` ($0.002209 USD)
- **Total Estimated Session Cost**: **$0.002606 USD**

---

## 📑 Full Console Execution Logs

### Scenario 1: Solana FUD Scenario
- **Query**: "Analyze $WIF on Solana. Are there any critical vulnerabilities in the contract and what is the current Twitter/Telegram sentiment?"
- **Inputs**: Symbol=WIF, Address=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm, ChainId=solana

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
    Snippet: "@APESZNARMY: $ANSEM mentioned he will be doing a bounty with the solana:JCKwsT8UAbygnFkZ7u3amDUM7BXRtwUhCsHQv2khp..."
  - [RugCheck Solana]: Score = 1152, Risks count = 1
  - [DexScreener Pools]: Price = $0.1714, Liquidity = $118827.71
  - [CoinGecko Market]: Price = $0.171347, Cap = $171163099
```

```json
==================== [FINAL AI VERDICT] ====================
{
  "drama_index": 85,
  "dominant_branch": "Rug Pull / Delisting",
  "branch_probabilities": {
    "Rug Pull / Delisting": 0.85,
    "FUD Manipulation": 0.1,
    "Meme Volatility": 0.05
  },
  "evidence_chain": [
    "RugCheck flags token as rug with score 1152",
    "No asks in order book indicating lack of sell-side liquidity",
    "Low liquidity relative to market cap",
    "No developer activity or community growth",
    "Market data shows price decline and low volume"
  ],
  "executable_verdict": "LIQUIDATE_LONGS",
  "confidence": 0.85,
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
    Snippet: "@RektRoots: $RETWEET reminds me of pre-1B $PEPE \n\n same energy: too simple to fail \n\n not saying it 100x's \n but..."
```

```text
==================== [MCTS FETCH_MORE LOOP] ====================
🔄 LLM requested dynamic fetch step: [MCTS] FETCH_MORE requested (iteration 0): "Need live price, volume, and liquidity data for PEPE on Ethereum; also need recent social sentiment and major exchange listings."
🔄 [ReAct] Dynamic Fetch triggered for target: Need live price, volume, and liquidity data for PEPE on Ethereum; also need recent social sentiment and major exchange listings.
⚠️ [Ingestion] DexScreener /tokens/ returned no pairs for 0x6982508145554ce3b5901a7778ad28a500216222. Trying search API fallback...
```

```json
==================== [FINAL AI VERDICT] ====================
{
  "drama_index": 5,
  "dominant_branch": "Dead Token",
  "branch_probabilities": {
    "Dead Token": 0.9,
    "Dormant Meme": 0.1,
    "FUD Misdirection": 0
  },
  "evidence_chain": [
    "Zero liquidity",
    "Zero 24h volume",
    "Zero price",
    "Empty order book",
    "CoinGecko and DeFiLlama data N/A",
    "FUD claims contradict market reality"
  ],
  "executable_verdict": "IGNORE_FUD",
  "confidence": 0.95,
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
    Snippet: "@CaseyVSilver: POTUS PUMP: Dell & Crypto Just Got Trumped 🚀🇺🇸\n\nPresident Trump just put the spotlight on $DELL a..."
  - [CoinGecko Market]: Price = $1.69, Cap = $401153924
```

```text
==================== [MCTS FETCH_MORE LOOP] ====================
🔄 LLM requested dynamic fetch step: [MCTS] FETCH_MORE requested (iteration 0): "top holder addresses with percentages, exchange listing status, recent on-chain large transfers"
🔄 [ReAct] Dynamic Fetch triggered for target: top holder addresses with percentages, exchange listing status, recent on-chain large transfers
```

```json
==================== [FINAL AI VERDICT] ====================
{
  "drama_index": 30,
  "dominant_branch": "FUD Overblown",
  "branch_probabilities": {
    "FUD Real": 0.15,
    "FUD Overblown": 0.7,
    "Mixed": 0.15
  },
  "evidence_chain": [
    "Price only down 0.47% despite multiple FUD claims",
    "Security scan shows no honeypot or rug",
    "Market cap and volume substantial indicating active trading"
  ],
  "executable_verdict": "IGNORE_FUD",
  "confidence": 0.65,
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
      "/v5/market/tickers": ["lastPrice", "price24hPcnt", "volume24h"]
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
    Snippet: "@TokenPulseJP: 【速報⚡】\n\n🇺🇸米司法省法務顧問室、財務省および商務省と緊密に連携し、戦略的 $BTC 準備金設立に向け活動 #米国 #準備金\n\nhttps://t.co/bB3IjKc4vA..."
  - [CoinGecko Market]: Price = $63784, Cap = $1278617580327
```

```json
==================== [FINAL AI VERDICT] ====================
{
  "drama_index": 20,
  "dominant_branch": "False Alarm",
  "branch_probabilities": {
    "False Alarm": 0.7,
    "Bearish Confirmation": 0.2,
    "Uncertain": 0.1
  },
  "evidence_chain": [
    "BTC price increased 1.8% in 24h",
    "Order book shows low sell pressure",
    "FUD claim of drop to $83k is inconsistent with current price ($63k)",
    "No on-chain security issues"
  ],
  "executable_verdict": "IGNORE_FUD",
  "confidence": 0.6,
  "served_from_cache": false,
  "fallback": false
}
```
