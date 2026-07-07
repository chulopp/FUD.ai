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

// DeepSeek deepseek-chat pricing (USD per 1M tokens)
const DEEPSEEK_PRICING = {
  cache_hit_per_1m: 0.0028,
  cache_miss_per_1m: 0.14,
  completion_per_1m: 0.28,
};

export class PipelineStepLogger {
  private steps: StepLog[] = [];

  log(step: StepLog): void {
    this.steps.push(step);
    console.log(
      `📊 [StepLogger] "${step.step_name}" — ` +
      `${step.input_tokens}in/${step.output_tokens}out tokens, ` +
      `${step.execution_time_ms}ms`
    );
  }

  getSummary(): StepSummary {
    const totalInput = this.steps.reduce((s, l) => s + l.input_tokens, 0);
    const totalOutput = this.steps.reduce((s, l) => s + l.output_tokens, 0);
    const totalCached = this.steps.reduce((s, l) => s + (l.cached_tokens ?? 0), 0);
    const cacheMiss = Math.max(0, totalInput - totalCached);
    const estimatedCost =
      (totalCached * DEEPSEEK_PRICING.cache_hit_per_1m +
       cacheMiss * DEEPSEEK_PRICING.cache_miss_per_1m +
       totalOutput * DEEPSEEK_PRICING.completion_per_1m) / 1_000_000;

    return {
      total_steps: this.steps.length,
      total_input_tokens: totalInput,
      total_output_tokens: totalOutput,
      total_time_ms: this.steps.reduce((s, l) => s + l.execution_time_ms, 0),
      estimated_cost_usd: parseFloat(estimatedCost.toFixed(6)),
      steps: [...this.steps],
    };
  }

  reset(): void {
    this.steps = [];
  }
}
