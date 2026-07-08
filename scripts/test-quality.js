const payloads = [
  { coin_symbol: "ANSEM", contract_address: "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump" },
  { coin_symbol: "BTC" },
  { coin_symbol: "HYPE" }
];

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQualityTests() {
  console.log("🚀 Starting Quality & MCTS Reasoning Tests sequentially...\n");
  for (let i = 0; i < payloads.length; i++) {
    const payload = payloads[i];
    console.log(`--- Test ${i + 1} (${payload.coin_symbol}) ---`);
    try {
      const res = await fetch("http://localhost:3000/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log(`Status: ${res.status}`);
      console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
      console.error("Test failed with error:", e.message);
    }
    if (i < payloads.length - 1) {
      console.log("\nWaiting 15 seconds before next request...");
      await delay(15000);
    }
  }
}

runQualityTests();
