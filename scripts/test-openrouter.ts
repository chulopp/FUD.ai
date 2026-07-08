import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const openrouterApiKey = process.env.OPENROUTER_API_KEY;
if (!openrouterApiKey) {
    console.error("Missing OPENROUTER_API_KEY in .env.local");
    process.exit(1);
}

const models = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-31b-it:free',
    'poolside/laguna-m.1:free'
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
        console.log(`✅ ${model} SUCCESS in ${Date.now() - start}ms -> Response: ${content.trim()}`);
    } catch (e: any) {
        console.log(`❌ ${model} failed in ${Date.now() - start}ms: ${e.message}`);
    }
}

async function main() {
    console.log("Starting OpenRouter PING test...");
    console.log("---------------------------------");
    for (const model of models) {
        await pingModel(model);
        // Wait 2 seconds to respect free tier rate limits (mostly for gemma/nemotron)
        await new Promise(r => setTimeout(r, 2000));
    }
    console.log("---------------------------------");
    console.log("Test finished!");
}

main();
