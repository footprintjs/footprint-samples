/**
 * Flowchart: Loops (loopTo + breakFn)
 *
 * Use `.loopTo(stageId)` to jump back to an earlier stage.
 * Call `breakFn()` inside a stage to exit the loop.
 *
 *   CallAPI ←──┐
 *       │      │
 *   EvaluateResult ──┘  (retries with backoff until success or max attempts)
 * Try it: https://footprintjs.github.io/footprint-playground/samples/loops
 */

import { flowChart, FlowChartExecutor, ScopeFacade } from 'footprint';

(async () => {

// ── Mock Unstable API ───────────────────────────────────────────────────

let callCount = 0;

const weatherAPI = {
  fetch: (city: string) => {
    callCount++;
    // Fails first 2 attempts, succeeds on 3rd
    if (callCount < 3) {
      throw new Error(`Service unavailable (attempt ${callCount})`);
    }
    return { city, tempC: 22, condition: 'partly cloudy', humidity: 65 };
  },
};

// ── Stage Functions ─────────────────────────────────────────────────────

const initRetry = async (scope: ScopeFacade) => {
  scope.setValue('city', 'Portland');
  scope.setValue('attempt', 0);
  scope.setValue('maxAttempts', 5);
  scope.setValue('lastError', null);
};

const callAPI = async (scope: ScopeFacade) => {
  const city = scope.getValue('city') as string;
  const attempt = (scope.getValue('attempt') as number) + 1;
  scope.setValue('attempt', attempt);

  try {
    const data = weatherAPI.fetch(city);
    scope.setValue('weather', data);
    scope.setValue('success', true);
    console.log(`  Attempt ${attempt}: success — ${data.tempC}°C, ${data.condition}`);
  } catch (err: any) {
    scope.setValue('success', false);
    scope.setValue('lastError', err.message);
    console.log(`  Attempt ${attempt}: ${err.message}`);
  }
};

const evaluateResult = async (scope: ScopeFacade, breakFn: () => void) => {
  const success = scope.getValue('success') as boolean;
  const attempt = scope.getValue('attempt') as number;
  const maxAttempts = scope.getValue('maxAttempts') as number;

  if (success) {
    scope.setValue('outcome', 'fetched');
    breakFn();
    return;
  }

  if (attempt >= maxAttempts) {
    const lastError = scope.getValue('lastError') as string;
    scope.setValue('outcome', `failed after ${attempt} attempts: ${lastError}`);
    breakFn();
    return;
  }

  // Exponential backoff: 50ms, 100ms, 200ms, ...
  const delay = 50 * Math.pow(2, attempt - 1);
  await new Promise((r) => setTimeout(r, delay));
};

// ── Flowchart ───────────────────────────────────────────────────────────

const chart = flowChart('InitRetry', initRetry, 'init-retry')
  .setEnableNarrative()
  .addFunction('CallAPI', callAPI, 'call-api')
  .addFunction('EvaluateResult', evaluateResult, 'evaluate-result')
  .loopTo('CallAPI')
  .build();

// ── Run ─────────────────────────────────────────────────────────────────

const executor = new FlowChartExecutor(chart);
await executor.run();

console.log('\n=== Loops (Retry with Backoff) ===\n');
executor.getNarrative().forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
