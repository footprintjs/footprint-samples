/**
 * Feature: MetricRecorder — Observability
 *
 * MetricRecorder tracks per-stage metrics:
 * - Read/write/commit counts
 * - Stage duration (latency)
 * - Invocation count
 *
 * Use this for dashboards, alerts, or performance profiling.
 *
 * Run:  npm run feature:metrics
 */

import {
  flowChart,
  FlowChartExecutor,
  ScopeFacade,
  MetricRecorder,
} from 'footprint';

(async () => {

const metrics = new MetricRecorder();

const chart = flowChart('FetchData', async (scope: ScopeFacade) => {
  scope.setValue('items', [1, 2, 3, 4, 5]);
  scope.setValue('source', 'api');
  // Simulate some async work
  await new Promise((r) => setTimeout(r, 50));
})
  .addFunction('Transform', async (scope: ScopeFacade) => {
    const items = scope.getValue('items') as number[];
    const doubled = items.map((n) => n * 2);
    scope.setValue('transformed', doubled);
    scope.setValue('count', doubled.length);
    // Simulate processing
    await new Promise((r) => setTimeout(r, 30));
  })
  .addFunction('Summarize', async (scope: ScopeFacade) => {
    const items = scope.getValue('transformed') as number[];
    const count = scope.getValue('count') as number;
    const sum = items.reduce((a, b) => a + b, 0);
    scope.setValue('summary', { count, sum, avg: sum / count });
    await new Promise((r) => setTimeout(r, 20));
  })
  .build();

const scopeFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(metrics);
  return scope;
};

const executor = new FlowChartExecutor(chart, scopeFactory);
await executor.run();

// ── Print per-stage metrics ─────────────────────────────────────────────

console.log('=== MetricRecorder — Per-Stage Observability ===\n');

const aggregated = metrics.getMetrics();

for (const [stage, m] of aggregated.stageMetrics) {
  console.log(`  ${stage}:`);
  console.log(`    reads: ${m.readCount}, writes: ${m.writeCount}, commits: ${m.commitCount}`);
  console.log(`    duration: ${m.totalDuration}ms, invocations: ${m.invocationCount}`);
}

console.log('\n  Summary:');
console.log(`    total reads: ${aggregated.totalReads}, total writes: ${aggregated.totalWrites}`);
console.log(`    total pipeline duration: ${aggregated.totalDuration}ms`);
})().catch(console.error);
