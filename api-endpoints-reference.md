# FUD.ai — Referensi Endpoint & Contoh Respons API Provider

Dokumen ini merangkum endpoint yang relevan untuk ingestion layer FUD.ai dari 8 provider: Bybit, GoPlus, RugCheck, DexScreener, DefiLlama, CoinGecko, Native Twitter Scraper (agent-twitter-client), dan Native Telegram Scraper (axios + cheerio). Untuk tiap provider: base URL, auth, daftar endpoint terpakai, dan contoh response.

---

## 1. Bybit (V5 API)

**Base URL:** `https://api.bybit.com` (mainnet) / `https://api-testnet.bybit.com` (testnet)
**Auth:** Tidak perlu API key untuk endpoint market data publik.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/v5/market/orderbook` | Depth order book (deteksi buy/sell wall) |
| GET | `/v5/market/tickers` | Snapshot harga, best bid/ask, volume 24h |
| GET | `/v5/market/recent-trade` | Riwayat trade publik terbaru |
| GET | `/v5/market/kline` | Data candlestick |

**Parameter utama:** `category` (`spot`/`linear`/`inverse`/`option`), `symbol` (misal `BTCUSDT`).

**Contoh respons `GET /v5/market/orderbook?category=spot&symbol=BTCUSDT`:**
```json
{
  "retCode": 0,
  "retMsg": "OK",
  "result": {
    "s": "BTCUSDT",
    "a": [["65557.7", "16.606555"]],
    "b": [["65485.47", "47.081829"]],
    "ts": 1716863719031,
    "u": 230704,
    "seq": 1432604333,
    "cts": 1716863718905
  },
  "time": 1716863719382
}
```
`a` = ask (harga, size) diurutkan naik; `b` = bid diurutkan turun.

**Contoh respons `GET /v5/market/tickers?category=spot&symbol=BTCUSDT`** (field kunci):
```json
{
  "result": {
    "list": [{
      "symbol": "BTCUSDT",
      "lastPrice": "120635.50",
      "price24hPcnt": "0.142425",
      "highPrice24h": "131309.30",
      "lowPrice24h": "102007.60",
      "volume24h": "13713832.0000",
      "bid1Price": "103401.00",
      "ask1Price": "109152.80"
    }]
  }
}
```

---

## 2. GoPlus Security

**Base URL:** `https://api.gopluslabs.io`
**Auth:** Free/permissionless untuk rate normal; `Authorization: Bearer <token>` untuk tier lebih tinggi.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/v1/token_security/{chain_id}?contract_addresses={address}` | Deteksi honeypot, mint function, ownership, tax, holder |
| GET | `/api/v1/address_security/{address}?chain_id={chain_id}` | Cek apakah alamat terkait aktivitas berbahaya |

`chain_id` numerik (1=Ethereum, 56=BSC, 8453=Base, dst).

**Contoh respons `token_security`** (field paling relevan untuk deteksi rugpull):
```json
{
  "code": 1,
  "message": "OK",
  "result": {
    "0x...tokenaddress": {
      "is_open_source": "1",
      "is_proxy": "0",
      "is_mintable": "1",
      "owner_address": "0x...",
      "can_take_back_ownership": "0",
      "hidden_owner": "0",
      "is_honeypot": "0",
      "buy_tax": "0",
      "sell_tax": "0",
      "cannot_sell_all": "0",
      "holder_count": "57472",
      "lp_holder_count": "48",
      "is_anti_whale": "0",
      "is_blacklisted": "0",
      "selfdestruct": "0",
      "trading_cooldown": "0",
      "token_name": "TeddyDoge",
      "token_symbol": "TEDDY"
    }
  }
}
```
> Catatan: ada juga `goplus-mcp` resmi (npm `goplus-mcp`) kalau mau akses via MCP tool (`token_security`, `malicious_address`, `solana_token_security`, dll) ketimbang REST langsung.

---

## 3. RugCheck.xyz

**Base URL:** `https://api.rugcheck.xyz`
**Auth:** API key (header `X-API-KEY`), daftar dulu di rugcheck.xyz untuk dapat key.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/v1/tokens/{mint}/report` | Report risiko lengkap (skor, risks, holder, LP) |
| GET | `/v1/tokens/search?query={q}` | Cari token by nama/simbol |
| GET | `/v1/wallet/{address}/risk` | Risk score sebuah wallet |

**Contoh field respons `tokens/{mint}/report`** (Solana-focused):
```json
{
  "mint": "6p6xg...GiPN",
  "score": 1250,
  "rugged": false,
  "risks": [
    { "name": "Low liquidity", "level": "warn" },
    { "name": "Mint authority still active", "level": "danger" }
  ],
  "tokenMeta": { "name": "...", "symbol": "..." },
  "creator": "...",
  "mintAuthority": "...",
  "freezeAuthority": null,
  "totalMarketLiquidity": 45210.5,
  "topHolders": [{ "address": "...", "pct": 12.4 }],
  "markets": [ { "liquidityA": 1000, "liquidityB": 1000 } ]
}
```

---

## 4. DexScreener

**Base URL:** `https://api.dexscreener.com`
**Auth:** Tidak perlu API key. Rate limit umum ~300 request/menit.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/latest/dex/search?q={query}` | Cari pair by nama/simbol token |
| GET | `/latest/dex/pairs/{chainId}/{pairId}` | Detail satu pair |
| GET | `/token-pairs/v1/{chainId}/{tokenAddress}` | Semua pair untuk 1 token |
| GET | `/tokens/v1/{chainId}/{tokenAddresses}` | Batch hingga 30 token address sekaligus |

**Contoh respons (struktur `pairs[]`):**
```json
{
  "schemaVersion": "1.0.0",
  "pairs": [{
    "chainId": "solana",
    "dexId": "raydium",
    "baseToken": { "address": "...", "name": "...", "symbol": "MEME" },
    "quoteToken": { "address": "...", "symbol": "SOL" },
    "priceUsd": "0.00042",
    "txns": { "h24": { "buys": 1200, "sells": 950 } },
    "volume": { "h24": 385000 },
    "priceChange": { "h24": -12.4 },
    "liquidity": { "usd": 92000, "base": 1000000, "quote": 500 },
    "fdv": 4200000,
    "marketCap": 3900000,
    "pairCreatedAt": 1716000000000
  }]
}
```

---

## 5. DefiLlama

**Base URL:** `https://api.llama.fi` (free tier, tanpa key)
**Auth:** Tidak perlu key untuk free tier (Pro $300/bln untuk rate limit lebih tinggi).

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/protocols` | List semua protokol + TVL saat ini |
| GET | `/protocol/{slug}` | Detail TVL historis + breakdown per chain/token |
| GET | `/tvl/{slug}` | Angka TVL saat ini saja (paling ringan) |
| GET | `/v2/historicalChainTvl/{chain}` | TVL historis satu chain |

**Contoh respons `/protocols`:**
```json
[
  {
    "id": "2269",
    "name": "Aave",
    "symbol": "AAVE",
    "category": "Lending",
    "chains": ["Ethereum", "Polygon"],
    "tvl": 5200000000,
    "chainTvls": { "Ethereum": 3200000000, "Polygon": 2000000000 },
    "change_1d": 2.1,
    "change_7d": -5.3
  }
]
```

---

## 6. CoinGecko

**Base URL:** `https://api.coingecko.com/api/v3` (free/demo, 30 call/menit tanpa key)
**Auth:** Demo key opsional untuk limit lebih tinggi; Pro key untuk `pro-api.coingecko.com`.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/coins/markets?vs_currency=usd&ids={id}` | Harga, market cap, volume untuk hingga 250 coin sekaligus |
| GET | `/coins/{id}` | Detail lengkap: harga, **community_data** (Twitter/Reddit followers), **developer_data** (GitHub commits/stars) |
| GET | `/simple/token_price/{platform}?contract_addresses={addr}&vs_currencies=usd` | Harga by contract address |
| GET | `/search/trending` | Top 7 koin trending 24 jam terakhir |

> `developer_data` dan `community_data` di endpoint `/coins/{id}` berguna sebagai sinyal tambahan untuk profiling developer (aktivitas GitHub sepi = red flag) dan validasi pertumbuhan komunitas organik vs pump buatan.

**Contoh respons `/coins/markets` (per item):**
```json
{
  "id": "bitcoin",
  "symbol": "btc",
  "current_price": 48523.95,
  "market_cap": 910315296035.72,
  "total_volume": 30555960117.67,
  "price_change_percentage_24h": 2.1
}
```

---

## 7. Native Twitter Scraper (agent-twitter-client)

> **Pivot 2026-07:** setelah MCP `xactions-mcp` dibuang (upstream packaging broken + Puppeteer/Chrome overhead + cookie-expiry fragility), ingestion X sekarang memakai native Node.js package [`agent-twitter-client`](https://www.npmjs.com/package/agent-twitter-client). Tidak ada stdio child-process, tidak ada browser headless — cukup HTTP + cookie/session di dalam proses yang sama.

Auth via env (urut prioritas):
1. `TWITTER_USERNAME` + `TWITTER_PASSWORD` (+ `TWITTER_EMAIL`) → login interaktif (paling stabil; 2FA otomatis lewat flow library).
2. `TWITTER_AUTH_TOKEN` + `TWITTER_CT0` → cookie pair yang diekstrak dari DevTools x.com.
3. `TWITTER_COOKIES='auth_token=xxx; ct0=yyy'` → raw cookie header form.
4. Guest mode (tanpa creds) — sejak 2025 Twitter memblokir search guest → 401/code-34. Untuk produksi wajib pakai opsi 1–3.

| Function | Fungsi |
|---|---|
| `searchTwitterSentiment(query, limit)` | Cari tweet by cashtag/hashtag/keyword, mode `SearchMode.Latest` |
| `fetchTwitterIntel(coinSymbol, strategy)` | Wrapper pipeline-hcompatible; query default `$SYMBOL OR SYMBOL crypto` |

Output normalized:
```json
{
  "tweets": [
    {
      "id": "1234567890",
      "username": "whale_alert",
      "text": "gm frens, big news coming soon 👀",
      "likes": 340,
      "retweets": 52,
      "views": 18500,
      "createdAt": "2026-07-05T02:14:00.000Z",
      "url": "https://x.com/whale_alert/status/1234567890"
    }
  ]
}
```

---

## 8. Native Telegram Scraper (axios + cheerio)

> **Pivot 2026-07:** MCP `chaindead/telegram-mcp` (MTProto) di-buang karena wajib login interaktif nomor HP + 2FA per-environment (blocker sandbox) + risiko suspend akun user asli untuk pemakaian intensif. Sebagai gantinya, ingestion Telegram sekarang scrape **public web preview** `https://t.me/s/{username}` memakai axios + cheerio. **Tanpa API key, tanpa login, tanpa rate-limit MTProto.**

| Function | Fungsi |
|---|---|
| `scrapeTelegramChannel(username, limit)` | Scrape {limit} pesan terakhir dari satu channel publik |
| `fetchTelegramIntel(coinSymbol, strategy, dynamicChannel?)` | Scan [17 channel intel default + 1 channel dinamis project] sekaligus; filter pesan yang menyebut cashtag |

Default intel channel list (Option A — hardcoded di `app/lib/ingestion/telegram.ts::DEFAULT_TELEGRAM_CHANNELS`):
`whale_alert_io, SM_News_24h, Next100XGEMSchat, CoingraphNews, Coinglass, sambelikanlabs, binance_announcements, cointelegraph, tomketloversreborn, Phantom_Solana_calls, santiment_network, vipdrprofit, glassnode, signalsbitcoinandethereum, CryptoBotEN, NEXT100XGEMS, blumcrypto_memepad`.

Dynamic official channel (Option B): pipeline bisa terima `telegram_identifier` dari CoinGecko links (akan di-pass sebagai argumen ketiga `fetchTelegramIntel`).

**Contoh hasil (`scrapeTelegramChannel('whale_alert_io')`):**
```json
{
  "messages": [
    {
      "id": "whale_alert_io/101662",
      "channel": "whale_alert_io",
      "datetime": "2026-07-05T03:29:55+00:00",
      "text": "🚨 1,624 $BTC (101,847,957 USD) transferred from unknown wallet to unknown wallet",
      "views": "9.88K",
      "media": []
    }
  ]
}
```

---

## Ringkasan Pemetaan ke Entitas ERD

| Provider | Mengisi entitas |
|---|---|
| Bybit | `ORDER_BOOK_SNAPSHOT` |
| GoPlus, RugCheck | `INGESTION_SNAPSHOT` (source_type=onchain), input ke `evidence_chain` kontrak |
| DexScreener, DefiLlama, CoinGecko | `INGESTION_SNAPSHOT` (source_type=onchain), data harga/likuiditas/TVL pelengkap |
| Native Twitter (agent-twitter-client) | `SOCIAL_POST` (platform=twitter) via `SOCIAL_CHANNEL`, media → `VISION_ANALYSIS` |
| Native Telegram (axios + cheerio) | `SOCIAL_POST` (platform=telegram) via `SOCIAL_CHANNEL` |
