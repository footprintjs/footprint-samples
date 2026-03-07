/**
 * Feature: Error Handling Patterns
 *
 * Demonstrates how to handle errors in footprint pipelines:
 * - try/catch around executor.run()
 * - DebugRecorder captures error details
 * - Partial metrics — see which stages ran before the crash
 * - Custom error recorder for production alerting
 *
 * Run:  npm run feature:errors
 */

import {
  FlowChartBuilder,
  FlowChartExecutor,
  ScopeFacade,
  MetricRecorder,
  DebugRecorder,
  type Recorder,
  type ErrorEvent,
  type WriteEvent,
} from 'footprint';

(async () => {

const silentLogger = { info() {}, log() {}, debug() {}, warn() {}, error() {} };

// ── Custom error alerting recorder ──────────────────────────────────────

class AlertRecorder implements Recorder {
  readonly alerts: Array<{ stage: string; error: string; timestamp: number }> = [];
  readonly writes: Array<{ stage: string; key: string }> = [];

  onWrite(event: WriteEvent): void {
    this.writes.push({ stage: event.stageName, key: event.key });
  }

  onError(event: ErrorEvent): void {
    this.alerts.push({
      stage: event.stageName,
      error: event.error?.message ?? String(event.error),
      timestamp: event.timestamp,
    });
  }
}

// ── Pipeline that fails mid-execution ───────────────────────────────────

console.log('=== Error Handling Patterns ===\n');
console.log('--- Scenario 1: Stage throws an error ---\n');

const metrics = new MetricRecorder();
const debug = new DebugRecorder('verbose');
const alerts = new AlertRecorder();

const chart = new FlowChartBuilder()
  .setLogger(silentLogger)
  .start('ValidateInput', async (scope: ScopeFacade) => {
    await new Promise((r) => setTimeout(r, 15));
    scope.setValue('userId', 'user-42');
    scope.setValue('payload', { action: 'transfer', amount: 50000 });
  })
  .addFunction('CheckLimits', async (scope: ScopeFacade) => {
    const payload = scope.getValue('payload') as any;
    await new Promise((r) => setTimeout(r, 25));
    if (payload.amount > 10000) {
      scope.setValue('limitExceeded', true);
      throw new Error(
        `Transfer amount $${payload.amount.toLocaleString()} exceeds daily limit of $10,000`,
      );
    }
    scope.setValue('limitExceeded', false);
  })
  .addFunction('ExecuteTransfer', async (scope: ScopeFacade) => {
    // This never runs
    scope.setValue('status', 'completed');
  })
  .build();

const scopeFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(metrics);
  scope.attachRecorder(debug);
  scope.attachRecorder(alerts);
  return scope;
};

const executor = new FlowChartExecutor(chart, scopeFactory);

try {
  await executor.run();
  console.log('  Pipeline completed successfully');
} catch (err: any) {
  console.log(`  Pipeline failed: ${err.message}`);
}

// ── Inspect what happened ───────────────────────────────────────────────

const m = metrics.getMetrics();
console.log(`\n  Stages that ran (${m.stageMetrics.size} of 3):`);
for (const [stage, sm] of m.stageMetrics) {
  console.log(`    ${stage}: ${sm.totalDuration}ms (${sm.writeCount} writes)`);
}

console.log(`\n  Writes before crash:`);
for (const w of alerts.writes) {
  console.log(`    ${w.stage} → ${w.key}`);
}

console.log(`\n  ExecuteTransfer: never ran — no metrics recorded`);

// ── DebugRecorder entries ───────────────────────────────────────────────

const entries = debug.getEntries();
console.log(`\n  DebugRecorder: ${entries.length} entries captured`);
console.log(`    writes: ${entries.filter((e) => e.type === 'write').length}`);
console.log(`    reads: ${entries.filter((e) => e.type === 'read').length}`);

// ── Scenario 2: Graceful degradation with try/catch inside a stage ──────

console.log('\n--- Scenario 2: Graceful error inside a stage ---\n');

const chart2 = new FlowChartBuilder()
  .start('FetchPrimary', async (scope: ScopeFacade) => {
    try {
      await new Promise((r) => setTimeout(r, 30));
      // Simulate API failure
      throw new Error('Primary API unavailable');
    } catch {
      // Fallback to cached data
      scope.setValue('source', 'cache');
      scope.setValue('data', { cached: true, score: 720 });
    }
  })
  .addFunction('Process', async (scope: ScopeFacade) => {
    const source = scope.getValue('source') as string;
    const data = scope.getValue('data') as any;
    scope.setValue('result', `Processed from ${source}: score=${data.score}`);
  })
  .build();

const scopeFactory2 = (ctx: any, stageName: string) => new ScopeFacade(ctx, stageName);
const executor2 = new FlowChartExecutor(chart2, scopeFactory2);
await executor2.run();

console.log('  Pipeline completed with fallback — no crash');
console.log('  Pattern: try/catch inside stage for graceful degradation');

})().catch(console.error);
