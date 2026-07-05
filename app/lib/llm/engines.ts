export async function runLightweightEngine(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.warn("[LLM Warning] OPENROUTER_API_KEY is missing.");
            return JSON.stringify({ error: "Lightweight Engine unavailable", fallback: true });
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": process.env.APP_URL || "https://fud.ai",
                "X-Title": "FUD.ai Epistemic Swarm",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-120b:free",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter responded with status ${response.status}`);
        }

        const data = await response.json();
        return data?.choices?.[0]?.message?.content || JSON.stringify({ error: "Empty response", fallback: true });
    } catch (error) {
        console.error("[LLM Error] runLightweightEngine failed:", error);
        return JSON.stringify({ error: "Lightweight Engine failed", fallback: true });
    }
}

export async function runHeavyweightEngine(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
        const apiKey = process.env.OPENCODEGO_API_KEY;
        const baseUrl = process.env.OPENCODEGO_BASE_URL || "https://api.opencode.go/v1/chat/completions";
        
        if (!apiKey) {
            console.warn("[LLM Warning] OPENCODEGO_API_KEY is missing.");
            return JSON.stringify({ error: "Heavyweight Engine unavailable", fallback: true });
        }

        const response = await fetch(baseUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "deepseek/deepseek-v4-flash",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`OpenCode Go responded with status ${response.status}`);
        }

        const data = await response.json();
        return data?.choices?.[0]?.message?.content || JSON.stringify({ error: "Empty response", fallback: true });
    } catch (error) {
        console.error("[LLM Error] runHeavyweightEngine failed:", error);
        return JSON.stringify({ error: "Heavyweight Engine failed", fallback: true });
    }
}

export async function runVisionEngine(systemPrompt: string, userPrompt: string, imageUrl: string): Promise<string> {
    try {
        const apiKey = process.env.OPENCODEGO_API_KEY;
        const baseUrl = process.env.OPENCODEGO_BASE_URL || "https://api.opencode.go/v1/chat/completions";

        if (!apiKey) {
            console.warn("[LLM Warning] OPENCODEGO_API_KEY is missing.");
            return JSON.stringify({ error: "Vision Engine unavailable", fallback: true });
        }

        const response = await fetch(baseUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "xiaomi/mimo-v2.5",
                messages: [
                    { role: "system", content: systemPrompt },
                    { 
                        role: "user", 
                        content: [
                            { type: "text", text: userPrompt },
                            { type: "image_url", image_url: { url: imageUrl } }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`OpenCode Go Vision API responded with status ${response.status}`);
        }

        const data = await response.json();
        return data?.choices?.[0]?.message?.content || JSON.stringify({ error: "Empty response", fallback: true });
    } catch (error) {
        console.error("[LLM Error] runVisionEngine failed:", error);
        return JSON.stringify({ error: "Vision Engine failed", fallback: true });
    }
}
