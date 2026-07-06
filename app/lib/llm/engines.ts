export async function runLightweightEngine(systemPrompt: string, userPrompt: string): Promise<string> {
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    // Step 1: Try Primary (Nvidia Nemotron 30B via OpenRouter)
    if (openrouterApiKey) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openrouterApiKey}`,
                    "HTTP-Referer": process.env.APP_URL || "https://fud.ai",
                    "X-Title": "FUD.ai Epistemic Swarm",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ]
                })
            });

            if (response.ok) {
                const data = await response.json();
                const content = data?.choices?.[0]?.message?.content;
                if (content) return content;
            } else {
                console.warn(`[LLM Warning] OpenRouter primary returned status ${response.status}. Trying fallback...`);
            }
        } catch (error) {
            console.error("[LLM Error] OpenRouter primary failed. Trying fallback...", error);
        }
    } else {
        console.warn("[LLM Warning] OPENROUTER_API_KEY is missing. Trying fallback...");
    }

    // Step 2: Fallback (Gemini 2.5 Flash via official Gemini API)
    if (geminiApiKey) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: userPrompt }
                            ]
                        }
                    ],
                    systemInstruction: {
                        parts: [
                            { text: systemPrompt }
                        ]
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) return content;
            } else {
                console.warn(`[LLM Warning] Gemini fallback returned status ${response.status}`);
            }
        } catch (error) {
            console.error("[LLM Error] Gemini fallback failed:", error);
        }
    } else {
        console.warn("[LLM Warning] GEMINI_API_KEY is missing.");
    }

    return JSON.stringify({ error: "Lightweight Engine failed on all targets", fallback: true });
}

export async function runHeavyweightEngine(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
        
        if (!apiKey) {
            console.warn("[LLM Warning] DEEPSEEK_API_KEY is missing.");
            return JSON.stringify({ error: "Heavyweight Engine unavailable", fallback: true });
        }

        const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "deepseek-v4-flash",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`DeepSeek responded with status ${response.status}: ${errText}`);
        }

        const data = await response.json();
        return data?.choices?.[0]?.message?.content || JSON.stringify({ error: "Empty response", fallback: true });
    } catch (error: any) {
        console.error("[LLM Error] runHeavyweightEngine failed:", error);
        return JSON.stringify({ error: `Heavyweight Engine failed: ${error.message}`, fallback: true });
    }
}

export async function runVisionEngine(systemPrompt: string, userPrompt: string, imageUrl: string): Promise<string> {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;

    let mimeType = "image/png";
    let base64Data = "";

    // Parse/Fetch Image helper
    if (imageUrl.startsWith("data:")) {
        const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
        }
    } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        try {
            const imgRes = await fetch(imageUrl);
            if (imgRes.ok) {
                const arrayBuffer = await imgRes.arrayBuffer();
                base64Data = Buffer.from(arrayBuffer).toString("base64");
                const contentType = imgRes.headers.get("content-type");
                if (contentType) mimeType = contentType;
            }
        } catch (err) {
            console.warn("[Vision Ingestion Warning] Failed to fetch remote imageUrl:", err);
        }
    }

    // Step 1: Try Primary (Official Gemini 2.5 Flash)
    if (geminiApiKey && base64Data) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: userPrompt },
                                {
                                    inlineData: {
                                        mimeType: mimeType,
                                        data: base64Data
                                    }
                                }
                            ]
                        }
                    ],
                    systemInstruction: {
                        parts: [
                            { text: systemPrompt }
                        ]
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) return content;
            } else {
                console.warn(`[LLM Warning] Gemini Primary Vision returned status ${response.status}. Trying fallback...`);
            }
        } catch (error) {
            console.error("[LLM Error] Gemini Primary Vision failed. Trying fallback...", error);
        }
    } else {
        console.warn("[LLM Warning] GEMINI_API_KEY missing or image data empty. Trying fallback...");
    }

    // Step 2: Fallback (Nvidia Nemotron 30B via OpenRouter)
    if (openrouterApiKey) {
        try {
            const messagesPayload: any = [
                {
                    role: "user",
                    content: [
                        { type: "text", text: userPrompt }
                    ]
                }
            ];

            if (base64Data) {
                messagesPayload[0].content.push({
                    type: "image_url",
                    image_url: {
                        url: `data:${mimeType};base64,${base64Data}`
                    }
                });
            } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
                messagesPayload[0].content.push({
                    type: "image_url",
                    image_url: {
                        url: imageUrl
                    }
                });
            }

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openrouterApiKey}`,
                    "HTTP-Referer": process.env.APP_URL || "https://fud.ai",
                    "X-Title": "FUD.ai Epistemic Swarm",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...messagesPayload
                    ]
                })
            });

            if (response.ok) {
                const data = await response.json();
                const content = data?.choices?.[0]?.message?.content;
                if (content) return content;
            } else {
                console.warn(`[LLM Warning] OpenRouter Fallback Vision returned status ${response.status}`);
            }
        } catch (error) {
            console.error("[LLM Error] OpenRouter Fallback Vision failed:", error);
        }
    } else {
        console.warn("[LLM Warning] OPENROUTER_API_KEY is missing for fallback vision.");
    }

    return JSON.stringify({ error: "Vision Engine failed on all targets", fallback: true });
}
