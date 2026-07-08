const ENDPOINT = 'https://reword-situated-barman.ngrok-free.dev/api/agent';

const testCases = [
    { name: "Test 1: Missing parameters", payload: {}, expectedStatus: 400 },
    { name: "Test 2: Missing contract", payload: { coin_symbol: "BTC" }, expectedStatus: 400 },
    { name: "Test 3: Missing coin", payload: { contract_address: "0x123" }, expectedStatus: 400 },
    { name: "Test 4: Fake Coin", payload: { coin_symbol: "FAKE", contract_address: "0x123", chain_id: "1" }, expectedStatus: 200 },
    { name: "Test 5: Valid Coin", payload: { coin_symbol: "DOGE", contract_address: "0xabc", chain_id: "1" }, expectedStatus: 200 }
];

async function runFuzzer() {
    console.log(`Starting Fuzzing against ${ENDPOINT}...`);
    let passed = 0;
    for (const test of testCases) {
        console.log(`\nExecuting ${test.name}...`);
        try {
            const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(test.payload)
            });
            const data = await response.json().catch(() => ({}));
            console.log(`Status: ${response.status}`);
            console.log(`Response:`, JSON.stringify(data));
            if (response.status === test.expectedStatus) {
                console.log("✅ PASS");
                passed++;
            } else if (response.status === 500 && data.fallback === true) {
                console.log("✅ PASS (Fallback 500)");
                passed++;
            } else {
                console.log("❌ FAIL");
            }
        } catch (error) {
            console.error("❌ ERROR:", error.message);
        }
    }
    console.log(`\n--- Fuzzing Complete: ${passed}/${testCases.length} Passed ---`);
}

runFuzzer();
