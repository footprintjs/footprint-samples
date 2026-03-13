/**
 * Feature: MetricRecorder — Full Observability
 *
 * MetricRecorder tracks per-stage metrics:
 * - Read/write/commit counts
 * - Stage duration (latency) via onStageStart/onStageEnd
 * - Invocation count
 *
 * This example simulates a realistic async pipeline with:
 * - Slow API calls (varying latency per stage)
 * - A stage that throws an error
 * - try/catch error handling around executor.run()
 * - DebugRecorder capturing errors for diagnostics
 *
 * Run:  npm run feature:metrics
 * Try it: https://footprintjs.github.io/footprint-playground/samples/metrics
 */

import {
  FlowChartBuilder,
  FlowChartExecutor,
  ScopeFacade,
  MetricRecorder,
  DebugRecorder,
} from 'footprint';

(async () => {

const metrics = new MetricRecorder();
const debug = new DebugRecorder('verbose');

// ── Simulated async helpers ─────────────────────────────────────────────

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Pipeline 1: Happy path (all stages succeed) ────────────────────────

console.log('=== Pipeline 1: Happy Path ===\n');

const happyChart = new FlowChartBuilder()
  .start('FetchUser', async (scope: ScopeFacade) => {
    await delay(60); // simulate DB query
    scope.setValue('user', { id: 1, name: 'Alice', tier: 'premium' });
  }, 'fetch-user')
  .addFunction('CallPricingAPI', async (scope: ScopeFacade) => {
    const user = scope.getValue('user') as any;
    await delay(120); // simulate slow external API
    scope.setValue('price', user.tier === 'premium' ? 79.99 : 99.99);
    scope.setValue('discount', user.tier === 'premium' ? 20 : 0);
  }, 'call-pricing-api')
  .addFunction('CalculateTax', async (scope: ScopeFacade) => {
    const price = scope.getValue('price') as number;
    await delay(10); // fast calculation
    scope.setValue('tax', Math.round(price * 0.08 * 100) / 100);
    scope.setValue('total', Math.round((price * 1.08) * 100) / 100);
  }, 'calculate-tax')
  .addFunction('SaveOrder', async (scope: ScopeFacade) => {
    const total = scope.getValue('total') as number;
    const user = scope.getValue('user') as any;
    await delay(45); // simulate DB write
    scope.setValue('orderId', `ORD-${Date.now()}`);
    scope.setValue('confirmation', `${user.name}: $${total}`);
  }, 'save-order')
  .build();

const happyScopeFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(metrics);
  return scope;
};

const happyExecutor = new FlowChartExecutor(happyChart, happyScopeFactory);
await happyExecutor.run();

// Print per-stage metrics
const happyMetrics = metrics.getMetrics();

for (const [stage, m] of happyMetrics.stageMetrics) {
  const bar = '█'.repeat(Math.max(1, Math.round(m.totalDuration / 5)));
  console.log(`  ${stage.padEnd(16)} ${bar} ${m.totalDuration}ms  (r:${m.readCount} w:${m.writeCount})`);
}

console.log(`\n  Total: ${happyMetrics.totalDuration}ms | ${happyMetrics.totalReads} reads, ${happyMetrics.totalWrites} writes`);

// ── Pipeline 2: Error path (stage throws) ───────────────────────────────

console.log('\n=== Pipeline 2: Error Handling ===\n');

const errorMetrics = new MetricRecorder();

const silentLogger = { info() {}, log() {}, debug() {}, warn() {}, error() {} };

const errorChart = new FlowChartBuilder()
  .setLogger(silentLogger)
  .start('LoadConfig', async (scope: ScopeFacade) => {
    await delay(20);
    scope.setValue('apiUrl', 'https://api.example.com');
    scope.setValue('retries', 3);
  }, 'load-config')
  .addFunction('CallExternalAPI', async (scope: ScopeFacade) => {
    const url = scope.getValue('apiUrl') as string;
    await delay(80); // simulate network call
    // Simulate an API failure
    throw new Error(`503 Service Unavailable: ${url} timed out after 80ms`);
  }, 'call-external-api')
  .addFunction('ProcessResponse', async (scope: ScopeFacade) => {
    // This stage never runs
    scope.setValue('result', 'processed');
  }, 'process-response')
  .build();

const errorScopeFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(errorMetrics);
  scope.attachRecorder(debug);
  return scope;
};

const errorExecutor = new FlowChartExecutor(errorChart, errorScopeFactory);

try {
  await errorExecutor.run();
} catch (err: any) {
  console.log(`  Caught error: ${err.message}`);
}

// Show metrics — note how ProcessResponse has no metrics (never ran)
const errResult = errorMetrics.getMetrics();

console.log('\n  Per-stage breakdown:');
for (const [stage, m] of errResult.stageMetrics) {
  const bar = '█'.repeat(Math.max(1, Math.round(m.totalDuration / 5)));
  console.log(`    ${stage.padEnd(18)} ${bar} ${m.totalDuration}ms  (r:${m.readCount} w:${m.writeCount})`);
}

console.log(`\n  Total before crash: ${errResult.totalDuration}ms`);
console.log(`  ProcessResponse never ran — no metrics recorded for it.`);

// Show debug entries captured by DebugRecorder
const debugEntries = debug.getEntries();
const errorEntries = debugEntries.filter(e => e.type === 'error');
const writeEntries = debugEntries.filter(e => e.type === 'write');

console.log(`\n  DebugRecorder captured: ${writeEntries.length} writes, ${errorEntries.length} errors`);
if (errorEntries.length > 0) {
  console.log(`  Last error: stage="${errorEntries[0].stageName}"`);
}

})().catch(console.error);
