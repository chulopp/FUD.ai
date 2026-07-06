# TestSprite AI Testing Report (MCP) — E2E Integration Grand Finale

---

## 1️⃣ Document Metadata
- **Project Name:** FUD.ai
- **Date:** 2026-07-06
- **Prepared by:** TestSprite AI Team (via Antigravity MCP)
- **Test Type:** Backend E2E Integration
- **Server:** `http://localhost:3000` (Next.js 16.2.10 — Production Build)
- **Pipeline Under Test:** `POST /api/agent` → Dispatcher → Parallel Ingestion → DeepSeek MCTS + ReAct

---

## 2️⃣ Requirement Validation Summary

### Requirement: Input Validation & Parameter Gating
Ensures `/api/agent` correctly validates request body parameters and rejects malformed requests before entering the MCTS pipeline.

#### Test TC002 — POST /api/agent missing coin_symbol returns 400
- **Test Code:** [TC002_post_api_agent_missing_coin_symbol_returns_400.py](./TC002_post_api_agent_missing_coin_symbol_returns_400.py)
- **Test Error:** None
- **Test Visualization and Result:** [TestSprite Dashboard](https://www.testsprite.com/dashboard/mcp/tests/0cdc5f2f-1860-4b0c-adc2-28c75f60cdde/33e00523-aede-4910-acf6-d2b9287165e1)
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Route correctly validates the payload and short-circuits with a 400 Bad Request status code when `coin_symbol` is missing.

---

### Requirement: FUD Analysis & MCTS Reasoning Pipeline
Validates the full pipeline execution including Granular Dispatcher routing, Parallel Ingestion, Lightweight noise filtering, and DeepSeek MCTS tree evaluation with ReAct loops. Ensures a structured JSON verdict is returned.

#### Test TC001 — POST /api/agent valid EVM token returns structured verdict
- **Test Code:** [TC001_post_api_agent_valid_EVM_token_returns_structured_verdict.py](./TC001_post_api_agent_valid_EVM_token_returns_structured_verdict.py)
- **Test Error:** None
- **Test Visualization and Result:** [TestSprite Dashboard](https://www.testsprite.com/dashboard/mcp/tests/0cdc5f2f-1860-4b0c-adc2-28c75f60cdde/a9ac7dba-859c-41e2-be94-e4ff4d7f8a39)
- **Status:** ✅ Passed
- **Severity:** CRITICAL
- **Analysis / Findings:** Full pipeline runs successfully with an EVM token (`DOGE` + CA). Response matches the schema containing all 8 required properties. `fallback=false`.

#### Test TC003 — POST /api/agent native token BTC without contract_address returns 200
- **Test Code:** [TC003_post_api_agent_native_token_without_contract_address_returns_200.py](./TC003_post_api_agent_native_token_without_contract_address_returns_200.py)
- **Test Error:** None
- **Test Visualization and Result:** [TestSprite Dashboard](https://www.testsprite.com/dashboard/mcp/tests/0cdc5f2f-1860-4b0c-adc2-28c75f60cdde/6a5ccc11-071a-4ec6-a845-1bcbd383dc09)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** Native token mode (no contract address) is successfully processed by the Dispatcher, bypassing on-chain DEX/security fetches, and correctly runs the social + LLM evaluation returning a structured verdict.

#### Test TC004 — POST /api/agent SOL with contract_address=native returns 200
- **Test Code:** [TC004_post_api_agent_Solana_token_with_native_contract_address_returns_200.py](./TC004_post_api_agent_Solana_token_with_native_contract_address_returns_200.py)
- **Test Error:** None
- **Test Visualization and Result:** [TestSprite Dashboard](https://www.testsprite.com/dashboard/mcp/tests/0cdc5f2f-1860-4b0c-adc2-28c75f60cdde/c33e9775-1984-47e4-af2e-c43690c41b93)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** Validates `contract_address="native"` sentinel parsing for Solana. Pipeline skips Ethereum-specific contract queries and runs the MCTS logic successfully.

#### Test TC005 — POST /api/agent unknown fake coin returns 200 with fallback indicators
- **Test Code:** [TC005_post_api_agent_unknown_fake_coin_returns_200_with_fallback_indicators.py](./TC005_post_api_agent_unknown_fake_coin_returns_200_with_fallback_indicators.py)
- **Test Error:** None
- **Test Visualization and Result:** [TestSprite Dashboard](https://www.testsprite.com/dashboard/mcp/tests/0cdc5f2f-1860-4b0c-adc2-28c75f60cdde/8a447f4f-8bee-4f58-a239-f7ca17768aa2)
- **Status:** ✅ Passed
- **Severity:** MEDIUM
- **Analysis / Findings:** Evaluates fallback resilience. With a non-existent fake token, the pipeline degrades gracefully to fallback values rather than throwing a 500 error, outputting structured fallback verdict metrics.

---

## 3️⃣ Coverage & Matching Metrics

- **100% of tests passed (5/5)**

| Requirement | Total Tests | ✅ Passed | ❌ Failed |
|---|---|---|---|
| Input Validation & Parameter Gating | 1 | 1 | 0 |
| FUD Analysis & MCTS Reasoning Pipeline | 4 | 4 | 0 |
| **TOTAL** | **5** | **5** | **0** |

---

## 4️⃣ Key Gaps / Risks
- **Network Latency & Timeouts:** High processing latency (45-90s) is typical when interacting with DeepSeek and executing multiple parallel scraping operations. The TestSprite runner configuration was patched with a 120s timeout to prevent execution timeouts.
- **Scraper Reliability:** Scrapers (cheerio/native Telegram/Twitter) depend heavily on target structure and may degrade over time, leading to higher fallback triggers. Semantic cache integration is recommended as the next major performance addition.
