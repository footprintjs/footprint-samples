/**
 * Feature: FlowRecorder — Pluggable observers for control flow events
 *
 * FlowRecorder mirrors the scope-level Recorder pattern for the engine layer.
 * Observe decisions, loops, forks, and other control flow events.
 *
 * This example demonstrates:
 *   1. Custom FlowRecorder for metrics/telemetry
 *   2. Built-in strategies for loop narrative compression
 *   3. SeparateNarrativeFlowRecorder for split loop detail
 *
 * Run:  npm run feature:flow-recorders
 */

import {
  flowChart,
  FlowChartExecutor,
  ScopeFacade,
  type FlowRecorder,
  NarrativeFlowRecorder,
  WindowedNarrativeFlowRecorder,
  SilentNarrativeFlowRecorder,
  SeparateNarrativeFlowRecorder,
  AdaptiveNarrativeFlowRecorder,
} from 'footprint';

// ── Helper: build a loop chart using dynamic continuation ─────────────────
// Dynamic continuation (returning a StageNode reference) is the engine's
// loop mechanism — it fires onLoop events that FlowRecorders observe.

function buildLoopChart(iterations = 20) {
  return flowChart('Init', async (scope: ScopeFacade) => {
    scope.setValue('counter', 0);
    scope.setValue('target', iterations);
  })
    .addFunction('Process', async (scope: ScopeFacade) => {
      const counter = scope.getValue('counter') as number;
      scope.setValue('counter', counter + 1);

      // Dynamic continuation: return a StageNode with `next` pointing back
      // This fires the engine's onLoop event that FlowRecorders observe
      if (counter + 1 < (scope.getValue('target') as number)) {
        return { name: 'loop-back', next: { name: 'Process', id: 'Process' } };
      }
    }, 'Process')
    .build();
}

const scopeFactory = (ctx: any, stageName: string) => new ScopeFacade(ctx, stageName);

(async () => {

  // ─── 1. Custom FlowRecorder: Metrics ────────────────────────────────────

  console.log('=== 1. Custom FlowRecorder (Metrics) ===\n');

  const metrics: FlowRecorder = {
    id: 'metrics',
    onStageExecuted: (event) => {
      console.log(`  [metric] stage: ${event.stageName}`);
    },
    onLoop: (event) => {
      if (event.iteration <= 3 || event.iteration % 5 === 0) {
        console.log(`  [metric] loop iteration ${event.iteration} → ${event.target}`);
      }
    },
    onBreak: (event) => {
      console.log(`  [metric] break at ${event.stageName}`);
    },
  };

  // Attach alongside default NarrativeFlowRecorder so we still get narrative
  const narrator1 = new NarrativeFlowRecorder();
  let executor = new FlowChartExecutor(buildLoopChart(10), scopeFactory);
  executor.attachFlowRecorder(narrator1);
  executor.attachFlowRecorder(metrics);
  await executor.run();
  console.log(`\n  Flow narrative: ${executor.getFlowNarrative().length} sentences\n`);

  // ─── 2. WindowedNarrativeFlowRecorder ───────────────────────────────────

  console.log('=== 2. Windowed Strategy (first 3 + last 2) ===\n');

  executor = new FlowChartExecutor(buildLoopChart(20), scopeFactory);
  executor.attachFlowRecorder(new WindowedNarrativeFlowRecorder(3, 2));
  await executor.run();

  const windowed = executor.getFlowNarrative();
  windowed.forEach((line) => console.log(`  ${line}`));
  console.log();

  // ─── 3. SilentNarrativeFlowRecorder ─────────────────────────────────────

  console.log('=== 3. Silent Strategy (summary only) ===\n');

  executor = new FlowChartExecutor(buildLoopChart(20), scopeFactory);
  executor.attachFlowRecorder(new SilentNarrativeFlowRecorder());
  await executor.run();

  const silent = executor.getFlowNarrative();
  silent.forEach((line) => console.log(`  ${line}`));
  console.log();

  // ─── 4. AdaptiveNarrativeFlowRecorder ───────────────────────────────────

  console.log('=== 4. Adaptive Strategy (full for 3, then every 5th) ===\n');

  executor = new FlowChartExecutor(buildLoopChart(20), scopeFactory);
  executor.attachFlowRecorder(new AdaptiveNarrativeFlowRecorder(3, 5));
  await executor.run();

  const adaptive = executor.getFlowNarrative();
  adaptive.forEach((line) => console.log(`  ${line}`));
  console.log();

  // ─── 5. SeparateNarrativeFlowRecorder ───────────────────────────────────

  console.log('=== 5. Separate Strategy (main + loop detail channels) ===\n');

  const separate = new SeparateNarrativeFlowRecorder();
  executor = new FlowChartExecutor(buildLoopChart(20), scopeFactory);
  executor.attachFlowRecorder(separate);
  await executor.run();

  console.log('  Main narrative:');
  executor.getFlowNarrative().forEach((line) => console.log(`    ${line}`));
  console.log(`\n  Loop detail (${separate.getLoopSentences().length} sentences):`);
  separate.getLoopSentences().slice(0, 3).forEach((line) => console.log(`    ${line}`));
  if (separate.getLoopSentences().length > 3) console.log('    ...');
  console.log(`\n  Loop counts:`, Object.fromEntries(separate.getLoopCounts()));

})().catch(console.error);
