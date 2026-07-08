/**
 * Per-step logger for the multi-step MCTS reasoning pipeline.
 *
 * Records every individual LLM call with: step name, model, token usage,
 * execution time. This proves to audit logs (and the client) that the
 * system performs genuine multi-step reasoning rather than a single-shot
 * prompt masquerading as MCTS.
 *
 * Min 5 calls per request is the correctness bar (P2-B requirement).
 */

export interface StepLog {
  step_name: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  execution_time_ms: number;
  timestamp: string;
  cached_tokens?: number;
}

export interface StepSummary {
  total_steps: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_time_ms: number;
  estimated_cost_usd: number;
  steps: StepLog[];
}

// MODEL pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { cache_hit?: number; input_per_1m: number; completion_per_1m: number }> = {
  'deepseek-chat': {
    cache_hit: 0.0028,
    input_per_1m: 0.14,
    completion_per_1m: 0.28,
  },
  'gemini-2.5-flash': {
    input_per_1m: 0.075,
    completion_per_1m: 0.30,
  },
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free': {
    input_per_1m: 0.00,
    completion_per_1m: 0.00,
  },
  'default': {
    input_per_1m: 0.10,
    completion_per_1m: 0.30,
  },
};

export class PipelineStepLogger {
  private steps: StepLog[] = [];

  log(step: StepLog): void {
    this.steps.push(step);
    console.log(
      `📊 [StepLogger] "${step.step_name}" (${step.model}) — ` +
      `${step.input_tokens}in/${step.output_tokens}out tokens, ` +
      `${step.execution_time_ms}ms`
    );
  }

  getSummary(): StepSummary {
    let estimatedCost = 0;

    for (const step of this.steps) {
      const modelKey = step.model.toLowerCase();
      const pricing = MODEL_PRICING[modelKey] || MODEL_PRICING['default'];

      const input = step.input_tokens;
      const output = step.output_tokens;
      const cached = step.cached_tokens ?? 0;
      const cacheHitPrice = pricing.cache_hit ?? pricing.input_per_1m;
      const cacheMiss = Math.max(0, input - cached);

      const stepCost =
        (cached * cacheHitPrice +
         cacheMiss * pricing.input_per_1m +
         output * pricing.completion_per_1m) / 1_000_000;
      estimatedCost += stepCost;
    }

    return {
      total_steps: this.steps.length,
      total_input_tokens: this.steps.reduce((s, l) => s + l.input_tokens, 0),
      total_output_tokens: this.steps.reduce((s, l) => s + l.output_tokens, 0),
      total_time_ms: this.steps.reduce((s, l) => s + l.execution_time_ms, 0),
      estimated_cost_usd: parseFloat(estimatedCost.toFixed(6)),
      steps: [...this.steps],
    };
  }

  reset(): void {
    this.steps = [];
  }
}
