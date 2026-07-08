const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    console.warn("⚠️ .env.local not found! Using existing environment variables.");
    return;
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const firstEq = trimmed.indexOf('=');
    if (firstEq === -1) return;
    const key = trimmed.substring(0, firstEq).trim();
    const val = trimmed.substring(firstEq + 1).trim();
    const cleanedVal = val.replace(/^["']|["']$/g, '');
    process.env[key] = cleanedVal;
  });
}

loadEnv();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Check image path (png first, fallback to jpg)
let chartPath = path.join(__dirname, 'test-chart.png');
if (!fs.existsSync(chartPath)) {
  chartPath = path.join(__dirname, 'test-chart.jpg');
}

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🔍 FUD.ai Trio LLM Isolation Test Preparation");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`- DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY ? '✅ Configured' : '❌ MISSING'}`);
console.log(`- DEEPSEEK_BASE_URL: ${DEEPSEEK_BASE_URL}`);
console.log(`- OPENROUTER_API_KEY: ${OPENROUTER_API_KEY ? '✅ Configured' : '❌ MISSING'}`);
console.log(`- GEMINI_API_KEY: ${GEMINI_API_KEY ? '✅ Configured' : '❌ MISSING'}`);
console.log(`- Image File: ${fs.existsSync(chartPath) ? `✅ Found (${path.basename(chartPath)}, size: ${(fs.statSync(chartPath).size / 1024).toFixed(1)} KB)` : '❌ MISSING'}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

async function runTests() {
  console.log("\n==================================================");
  console.log("🚀 Starting Trio LLM Isolation Test...");
  console.log("==================================================\n");

  // Run Test 1
  await testDeepSeek();

  // Run Test 2
  await testOpenRouter();

  // Run Test 3
  await testGemini();
}

async function testDeepSeek() {
  console.log("⏳ Test 1: Heavyweight Engine (Official DeepSeek V3)...");
  if (!DEEPSEEK_API_KEY) {
    console.error("❌ Skipped: DEEPSEEK_API_KEY is not defined in env.\n");
    return { success: false, error: "Missing API Key" };
  }

  const endpoint = `${DEEPSEEK_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`;
  console.log(`🔗 Endpoint: ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are the FUD.ai MCTS heavyweight engine. Respond ONLY in valid JSON." },
          { role: "user", content: "Analyze token safety risk for an unverified contract address." }
        ],
        response_format: { type: "json_object" }
      })
    });

    const status = response.status;
    const rawText = await response.text();
    console.log(`📡 Status Code: ${status}`);

    if (!response.ok) {
      throw new Error(`HTTP ${status}: ${rawText}`);
    }

    const data = JSON.parse(rawText);
    const content = data.choices?.[0]?.message?.content;
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };

    console.log("✅ Response Received:");
    console.log(content);
    console.log("\n📊 Token Usage:");
    console.log(`- Input Tokens: ${usage.prompt_tokens}`);
    console.log(`- Output Tokens: ${usage.completion_tokens}`);
    console.log(`- Total Tokens: ${usage.total_tokens || (usage.prompt_tokens + usage.completion_tokens)}`);

    // DeepSeek V3 Pricing: $0.14 / 1M input, $0.28 / 1M output
    const inputCost = (usage.prompt_tokens * 0.14) / 1000000;
    const outputCost = (usage.completion_tokens * 0.28) / 1000000;
    const totalCost = inputCost + outputCost;

    console.log(`💰 Cost Breakdown:`);
    console.log(`- Input Cost:  $${inputCost.toFixed(8)}`);
    console.log(`- Output Cost: $${outputCost.toFixed(8)}`);
    console.log(`- Total Cost:  $${totalCost.toFixed(8)}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return { success: true, cost: totalCost };
  } catch (error) {
    console.error("❌ DeepSeek Test Failed:", error.message);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return { success: false, error: error.message };
  }
}

async function testOpenRouter() {
  console.log("⏳ Test 2: Noise Filter Engine (OpenRouter/Gemini Fallback)...");
  
  // Step 1: Try Primary (Nvidia Nemotron 30B from OpenRouter)
  if (OPENROUTER_API_KEY) {
    const endpoint = "https://openrouter.ai/api/v1/chat/completions";
    const model = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
    console.log(`📡 Trying Primary Filter Engine: ${model} via OpenRouter...`);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://fud.ai",
          "X-Title": "FUD.ai Isolation Test"
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "user", content: "Filter out the noise from this social claim: 'DEV DUMPED 99% OF SUPPLY!!!' (Context: Dev only sold 0.5% for liquidity pool)" }
          ]
        })
      });

      const status = response.status;
      const rawText = await response.text();
      console.log(`📡 Status Code for ${model}: ${status}`);

      if (!response.ok) {
        throw new Error(`HTTP ${status}: ${rawText}`);
      }

      const data = JSON.parse(rawText);
      const content = data.choices?.[0]?.message?.content;
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };

      console.log("✅ Response Received (Primary):");
      console.log(content);
      console.log("\n📊 Token Usage:");
      console.log(`- Input Tokens: ${usage.prompt_tokens}`);
      console.log(`- Output Tokens: ${usage.completion_tokens}`);

      // Free model: Cost is $0.00
      console.log(`💰 Cost Breakdown (${model}):`);
      console.log(`- Total Cost:  $0.00000000 (Free Tier Model)`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      return { success: true, cost: 0, model };
    } catch (error) {
      console.warn(`⚠️ Primary Filter Engine (${model}) failed/rate-limited:`, error.message);
    }
  } else {
    console.warn("⚠️ OPENROUTER_API_KEY is not defined in env.");
  }

  // Step 2: Fallback to Gemini 2.5 Flash
  console.log(`📡 Falling back to Gemini 2.5 Flash (Official API)...`);
  if (!GEMINI_API_KEY) {
    console.error("❌ Fallback Failed: GEMINI_API_KEY is not defined in env.\n");
    return { success: false, error: "Primary failed and missing Gemini API Key for fallback" };
  }

  const geminiModel = "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: "Filter out the noise from this social claim: 'DEV DUMPED 99% OF SUPPLY!!!' (Context: Dev only sold 0.5% for liquidity pool)" }
            ]
          }
        ]
      })
    });

    const status = response.status;
    const rawText = await response.text();
    console.log(`📡 Status Code for Fallback ${geminiModel}: ${status}`);

    if (!response.ok) {
      throw new Error(`HTTP ${status}: ${rawText}`);
    }

    const data = JSON.parse(rawText);
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const usage = data.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };

    console.log("✅ Response Received (Fallback):");
    console.log(content);
    console.log("\n📊 Token Usage:");
    console.log(`- Input Tokens: ${usage.promptTokenCount}`);
    console.log(`- Output Tokens: ${usage.candidatesTokenCount}`);

    // Gemini Flash Rates: $0.075 per 1M input, $0.30 per 1M output
    const inputCost = (usage.promptTokenCount * 0.075) / 1000000;
    const outputCost = (usage.candidatesTokenCount * 0.30) / 1000000;
    const totalCost = inputCost + outputCost;

    console.log(`💰 Cost Breakdown (${geminiModel}):`);
    console.log(`- Input Cost:  $${inputCost.toFixed(8)}`);
    console.log(`- Output Cost: $${outputCost.toFixed(8)}`);
    console.log(`- Total Cost:  $${totalCost.toFixed(8)}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return { success: true, cost: totalCost, model: geminiModel };
  } catch (error) {
    console.error("❌ Fallback to Gemini 2.5 Flash failed:", error.message);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return { success: false, error: error.message };
  }
}

async function testGemini() {
  console.log("⏳ Test 3: Image/Vision Engine (Gemini/OpenRouter Fallback)...");
  if (!fs.existsSync(chartPath)) {
    console.error(`❌ Skipped: Test chart image not found at ${chartPath}.\n`);
    return { success: false, error: "Missing Test Chart Image" };
  }

  const imageBuffer = fs.readFileSync(chartPath);
  const base64Data = imageBuffer.toString('base64');
  const mimeType = path.extname(chartPath) === '.png' ? 'image/png' : 'image/jpeg';
  const promptText = "Analyze this trading chart image. Identify the immediate support/resistance levels and check if there's a breakdown pattern.";

  // Step 1: Try Primary (Official Gemini 2.5 Flash)
  if (GEMINI_API_KEY) {
    const model = "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    console.log(`📡 Trying Primary Vision Engine: ${model} via Gemini API...`);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ]
        })
      });

      const status = response.status;
      const rawText = await response.text();
      console.log(`📡 Status Code for Primary ${model}: ${status}`);

      if (!response.ok) {
        throw new Error(`HTTP ${status}: ${rawText}`);
      }

      const data = JSON.parse(rawText);
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      console.log("🧩 Raw JSON Response (first 1000 characters):");
      console.log(rawText.slice(0, 1000) + (rawText.length > 1000 ? "... [TRUNCATED]" : ""));
      
      console.log("\n✅ Response Received (Primary):");
      console.log(content);

      const usage = data.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };
      console.log("\n📊 Token Usage:");
      console.log(`- Input Tokens: ${usage.promptTokenCount}`);
      console.log(`- Output Tokens: ${usage.candidatesTokenCount}`);
      console.log(`- Total Tokens: ${usage.totalTokenCount || (usage.promptTokenCount + usage.candidatesTokenCount)}`);

      // Gemini Flash Rates: $0.075 per 1M input, $0.30 per 1M output
      const inputCost = (usage.promptTokenCount * 0.075) / 1000000;
      const outputCost = (usage.candidatesTokenCount * 0.30) / 1000000;
      const totalCost = inputCost + outputCost;

      console.log(`💰 Cost Breakdown (${model}):`);
      console.log(`- Input Cost:  $${inputCost.toFixed(8)}`);
      console.log(`- Output Cost: $${outputCost.toFixed(8)}`);
      console.log(`- Total Cost:  $${totalCost.toFixed(8)}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      return { success: true, cost: totalCost, model };
    } catch (error) {
      console.warn(`⚠️ Primary Vision Engine (${model}) failed:`, error.message);
    }
  } else {
    console.warn("⚠️ GEMINI_API_KEY is not defined in env.");
  }

  // Step 2: Fallback to OpenRouter (Nvidia Nemotron Omni 30B)
  console.log(`📡 Falling back to OpenRouter (nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free)...`);
  if (!OPENROUTER_API_KEY) {
    console.error("❌ Fallback Failed: OPENROUTER_API_KEY is not defined in env.\n");
    return { success: false, error: "Primary failed and missing OpenRouter API Key for fallback" };
  }

  const orModel = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://fud.ai",
        "X-Title": "FUD.ai Isolation Test"
      },
      body: JSON.stringify({
        model: orModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: promptText
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`
                }
              }
            ]
          }
        ]
      })
    });

    const status = response.status;
    const rawText = await response.text();
    console.log(`📡 Status Code for Fallback ${orModel}: ${status}`);

    if (!response.ok) {
      throw new Error(`HTTP ${status}: ${rawText}`);
    }

    const data = JSON.parse(rawText);
    const content = data.choices?.[0]?.message?.content;
    
    console.log("🧩 Raw JSON Response (first 1000 characters):");
    console.log(rawText.slice(0, 1000) + (rawText.length > 1000 ? "... [TRUNCATED]" : ""));
    
    console.log("\n✅ Response Received (Fallback):");
    console.log(content);

    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
    console.log("\n📊 Token Usage:");
    console.log(`- Input Tokens: ${usage.prompt_tokens}`);
    console.log(`- Output Tokens: ${usage.completion_tokens}`);

    console.log(`💰 Cost Breakdown (${orModel}):`);
    console.log(`- Total Cost:  $0.00000000 (Free Tier Model)`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return { success: true, cost: 0, model: orModel };
  } catch (error) {
    console.error(`❌ Fallback to OpenRouter (${orModel}) failed:`, error.message);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return { success: false, error: error.message };
  }
}

runTests().then(() => {
  console.log("🎉 Isolation Test Run Completed.");
});
