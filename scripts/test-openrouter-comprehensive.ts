import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const openrouterApiKey = process.env.OPENROUTER_API_KEY;
if (!openrouterApiKey) {
    console.error("Missing OPENROUTER_API_KEY in .env.local");
    process.exit(1);
}

const models = [
    // Heavyweight
    'nvidia/nemotron-3-super-120b-a12b:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'openai/gpt-oss-120b:free',
    'qwen/qwen3-coder:free',
    'nousresearch/hermes-3-llama-3.1-405b:free',
    
    // Lightweight
    'poolside/laguna-xs-2.1:free',
    'cohere/north-mini-code:free',
    'nvidia/nemotron-3.5-content-safety:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'nvidia/nemotron-nano-12b-v2-vl:free',
    'openai/gpt-oss-20b:free',
    'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
    'meta-llama/llama-3.2-3b-instruct:free',

    // Vision
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free'
];

async function pingModel(model: string) {
    const start = Date.now();
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openrouterApiKey}`,
                "HTTP-Referer": "https://fud.ai",
                "X-Title": "FUD.ai Epistemic Swarm",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: "Reply exactly with 'PONG'." }]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.log(`❌ ${model} failed HTTP ${response.status} in ${Date.now() - start}ms: ${err}`);
            return;
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        console.log(`✅ ${model} SUCCESS in ${Date.now() - start}ms -> Response: ${content?.trim()}`);
    } catch (e: any) {
        console.log(`❌ ${model} failed in ${Date.now() - start}ms: ${e.message}`);
    }
}

async function main() {
    console.log("Starting OpenRouter Comprehensive PING test...");
    console.log("----------------------------------------------");
    for (const model of models) {
        await pingModel(model);
        // Wait 2 seconds to respect free tier rate limits
        await new Promise(r => setTimeout(r, 2000));
    }
    console.log("----------------------------------------------");
    console.log("Test finished!");
}

main();
