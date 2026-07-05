const payloads = [
  { coin_symbol: "ANSEM", contract_address: "8q4v1uA5gJt3u8CgG82wUu3V9H1R3K3X5x5E5C4w4o4" },
  { coin_symbol: "BTC", contract_address: "native" },
  { coin_symbol: "HYPE", contract_address: "0x0000000000000000000000000000000000000000" }
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
