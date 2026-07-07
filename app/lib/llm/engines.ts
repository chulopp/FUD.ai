import https from 'https';

// ─────────────────────────────────────────────────────────────
// Keep-Alive HTTPS Agent — reuses TCP connections across parallel
// DeepSeek API calls during MCTS rollouts, eliminating per-call
// TCP handshake overhead (~50-100ms per connection).
// Scoped to this module to avoid affecting other fetch calls.
// ─────────────────────────────────────────────────────────────
const KEEP_ALIVE_AGENT = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000, // send TCP keep-alive every 10 seconds
  maxSockets: 20,        // allow up to 20 parallel sockets to DeepSeek
});

// ─────────────────────────────────────────────────────────────
// HeavyweightEngine result — bundles content + token usage
// so callers can log per-step costs accurately.
// ─────────────────────────────────────────────────────────────
export interface HeavyweightResult {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    cached_tokens: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Lightweight Engine
// Primary: Nvidia Nemotron 30B via OpenRouter
// Fallback: Gemini 2.5 Flash via Gemini API
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Heavyweight Engine — DeepSeek API (direct, not via OpenCode Go)
//
// Reliability contract:
//   • 2x exponential-backoff retries (2s → 4s) before declaring failure.
//   • On permanent failure, THROWS an Error — callers MUST catch and
//     convert to a degraded verdict.  We do NOT return parseable fallback
//     JSON because that silently masquerades as a real analysis result.
//
// Bybit note: api.bybit.com is blocked in Indonesia; this system uses
// api.bytick.com as the production endpoint (set via BYBIT_BASE_URL env).
// api-testnet.bytick.com is the testnet fallback for CI/local dev.
// ─────────────────────────────────────────────────────────────

const HEAVYWEIGHT_MAX_RETRIES = 2;
const HEAVYWEIGHT_BASE_DELAY_MS = 2000;

export async function runHeavyweightEngine(
    systemPrompt: string,
    userPrompt: string
): Promise<HeavyweightResult> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    // Direct DeepSeek API — not routed via OpenCode Go which had production
    // timeouts during testing. See PRD architecture decisions.
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

    if (!apiKey) {
        throw new Error('heavyweight_engine_unavailable: DEEPSEEK_API_KEY is not configured');
    }

    const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= HEAVYWEIGHT_MAX_RETRIES; attempt++) {
        if (attempt > 0) {
            const delay = HEAVYWEIGHT_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            console.warn(`[HeavyweightEngine] Retry ${attempt}/${HEAVYWEIGHT_MAX_RETRIES} in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    response_format: { type: "json_object" }
                }),
                // @ts-ignore — Node.js native fetch supports the 'agent' option
                // for connection reuse via keep-alive. This is a Node.js-only
                // feature and is safely ignored in Edge/browser environments.
                agent: KEEP_ALIVE_AGENT,
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`DeepSeek responded with status ${response.status}: ${errText}`);
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('DeepSeek returned empty content');
            }

            const u = data.usage ?? {};
            return {
                content,
                usage: {
                    prompt_tokens: u.prompt_tokens ?? 0,
                    completion_tokens: u.completion_tokens ?? 0,
                    cached_tokens: u.prompt_tokens_details?.cached_tokens ?? 0,
                }
            };
        } catch (error: any) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.error(`[HeavyweightEngine] Attempt ${attempt + 1}/${HEAVYWEIGHT_MAX_RETRIES + 1} failed:`, lastError.message);
        }
    }

    // All retries exhausted — throw so callers can return a proper degraded verdict.
    // We intentionally do NOT return parseable JSON here because that would allow
    // downstream code to accidentally treat the failure as a real analysis result.
    throw new Error(`heavyweight_engine_unavailable: ${lastError.message}`);
}

// ─────────────────────────────────────────────────────────────
// Vision Engine
// Primary: Gemini 2.5 Flash (official Gemini API)
// Fallback: Nvidia Nemotron 30B via OpenRouter
// ─────────────────────────────────────────────────────────────
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
