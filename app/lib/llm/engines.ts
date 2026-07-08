import https from 'https';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

// ─────────────────────────────────────────────────────────────
// Keep-Alive HTTPS Agent — reuses TCP connections across parallel
// API calls during MCTS rollouts, eliminating per-call
// TCP handshake overhead (~50-100ms per connection).
// ─────────────────────────────────────────────────────────────
const KEEP_ALIVE_AGENT = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000, // send TCP keep-alive every 10 seconds
  maxSockets: 20,
});

// ─────────────────────────────────────────────────────────────
// HeavyweightEngine result — bundles content + token usage
// ─────────────────────────────────────────────────────────────
export interface HeavyweightResult {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    cached_tokens: number;
  };
}

export type LLMProvider = 'openrouter' | 'bedrock' | 'deepseek';

export interface CascadeModel {
    provider: LLMProvider;
    modelId: string;
}

// ─────────────────────────────────────────────────────────────
// Multi-Tier Cascade Helper
// ─────────────────────────────────────────────────────────────
async function executeLLMWithCascade(
    systemPrompt: string,
    userPrompt: string,
    cascadeArray: CascadeModel[]
): Promise<HeavyweightResult> {
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

    let lastError: Error = new Error("Empty cascade array");

    for (const model of cascadeArray) {
        try {
            console.log(`[LLM Cascade] Attempting model ${model.modelId} via ${model.provider}...`);
            
            if (model.provider === 'openrouter') {
                if (!openrouterApiKey) throw new Error("OPENROUTER_API_KEY missing");
                
                const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${openrouterApiKey}`,
                        "HTTP-Referer": process.env.APP_URL || "https://fud.ai",
                        "X-Title": "FUD.ai Epistemic Swarm",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: model.modelId,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
                        ]
                    })
                }, 25_000); // 25s timeout for OpenRouter cascade

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`OpenRouter returned status ${response.status}: ${errText}`);
                }

                const data = await response.json();
                const content = data?.choices?.[0]?.message?.content;
                if (!content) throw new Error("OpenRouter returned empty content");
                
                return {
                    content,
                    usage: {
                        prompt_tokens: data?.usage?.prompt_tokens ?? 0,
                        completion_tokens: data?.usage?.completion_tokens ?? 0,
                        cached_tokens: data?.usage?.prompt_tokens_details?.cached_tokens ?? 0,
                    }
                };

            } else if (model.provider === 'deepseek') {
                if (!deepseekApiKey) throw new Error("DEEPSEEK_API_KEY missing");
                const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
                const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
                
                const response = await fetchWithTimeout(endpoint, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${deepseekApiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: model.modelId,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
                        ],
                        response_format: { type: "json_object" }
                    }),
                    // @ts-ignore
                    agent: KEEP_ALIVE_AGENT,
                } as any, 25_000);

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`DeepSeek returned status ${response.status}: ${errText}`);
                }

                const data = await response.json();
                const content = data?.choices?.[0]?.message?.content;
                if (!content) throw new Error("DeepSeek returned empty content");
                
                return {
                    content,
                    usage: {
                        prompt_tokens: data?.usage?.prompt_tokens ?? 0,
                        completion_tokens: data?.usage?.completion_tokens ?? 0,
                        cached_tokens: data?.usage?.prompt_tokens_details?.cached_tokens ?? 0,
                    }
                };
            }
        } catch (error: any) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`[LLM Cascade] Model ${model.modelId} failed: ${lastError.message}. Falling back...`);
        }
    }

    throw new Error(`heavyweight_engine_unavailable: All cascade models failed. Last error: ${lastError.message}`);
}

// ─────────────────────────────────────────────────────────────
// Lightweight Engine
// ─────────────────────────────────────────────────────────────
export async function runLightweightEngine(systemPrompt: string, userPrompt: string): Promise<string> {
    const cascade: CascadeModel[] = [
        { provider: 'openrouter', modelId: 'nvidia/nemotron-3-super-120b-a12b:free' },
        { provider: 'openrouter', modelId: 'google/gemma-4-31b-it:free' },
        { provider: 'openrouter', modelId: 'poolside/laguna-m.1:free' },
        { provider: 'openrouter', modelId: 'poolside/laguna-xs-2.1:free' },
        { provider: 'openrouter', modelId: 'cohere/north-mini-code:free' },
        { provider: 'openrouter', modelId: 'nvidia/nemotron-3.5-content-safety:free' },
        { provider: 'openrouter', modelId: 'nvidia/nemotron-3-nano-30b-a3b:free' },
        { provider: 'openrouter', modelId: 'nvidia/nemotron-nano-12b-v2-vl:free' },
        { provider: 'openrouter', modelId: 'openai/gpt-oss-20b:free' },
        { provider: 'openrouter', modelId: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free' },
        { provider: 'openrouter', modelId: 'meta-llama/llama-3.2-3b-instruct:free' },
        { provider: 'openrouter', modelId: 'meta-llama/llama-3.3-70b-instruct:free' }
    ];

    try {
        const result = await executeLLMWithCascade(systemPrompt, userPrompt, cascade);
        return result.content;
    } catch (error: any) {
        console.error("[LLM Error] Lightweight Cascade failed completely:", error);
        return JSON.stringify({ error: "Lightweight Engine failed on all targets", fallback: true });
    }
}

// ─────────────────────────────────────────────────────────────
// Heavyweight Engine
// ─────────────────────────────────────────────────────────────
export async function runHeavyweightEngine(
    systemPrompt: string,
    userPrompt: string
): Promise<HeavyweightResult> {
    const cascade: CascadeModel[] = [
        { provider: 'deepseek', modelId: 'deepseek-chat' }, // Primary Model
        { provider: 'openrouter', modelId: 'nvidia/nemotron-3-super-120b-a12b:free' }, // Fallback
        { provider: 'openrouter', modelId: 'qwen/qwen3-next-80b-a3b-instruct:free' },
        { provider: 'openrouter', modelId: 'openai/gpt-oss-120b:free' },
        { provider: 'openrouter', modelId: 'qwen/qwen3-coder:free' },
        { provider: 'openrouter', modelId: 'nousresearch/hermes-3-llama-3.1-405b:free' },
        // Reliable Lightweight Fallbacks
        { provider: 'openrouter', modelId: 'poolside/laguna-xs-2.1:free' },
        { provider: 'openrouter', modelId: 'cohere/north-mini-code:free' },
        { provider: 'openrouter', modelId: 'nvidia/nemotron-3-nano-30b-a3b:free' },
        { provider: 'openrouter', modelId: 'openai/gpt-oss-20b:free' },
        { provider: 'openrouter', modelId: 'meta-llama/llama-3.3-70b-instruct:free' }
    ];

    return await executeLLMWithCascade(systemPrompt, userPrompt, cascade);
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

    // Step 2: Fallbacks via OpenRouter
    if (openrouterApiKey) {
        const fallbacks = [
            "google/gemma-4-31b-it:free",
            "google/gemma-4-26b-a4b-it:free",
            "nvidia/nemotron-nano-12b-v2-vl:free"
        ];

        for (const fallbackModel of fallbacks) {
            try {
                console.log(`[LLM Cascade] Attempting Vision fallback model ${fallbackModel}...`);
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
                        model: fallbackModel,
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
                    console.warn(`[LLM Warning] OpenRouter Vision Fallback ${fallbackModel} returned status ${response.status}`);
                }
            } catch (error) {
                console.error(`[LLM Error] OpenRouter Vision Fallback ${fallbackModel} failed:`, error);
            }
        }
    } else {
        console.warn("[LLM Warning] OPENROUTER_API_KEY is missing for fallback vision.");
    }

    return JSON.stringify({ error: "Vision Engine failed on all targets", fallback: true });
}
