/**
 * FlowRecorder: Multiple Recorders
 *
 * Demonstrates attaching multiple FlowRecorders to the same execution.
 * Each recorder sees the same events independently — like scope Recorders
 * but for control flow.
 *
 * Shows:
 *   - Narrative + metrics side-by-side
 *   - Detaching a recorder mid-lifecycle
 *   - Error isolation (one recorder failing doesn't affect others)
 *
 * Run:  npm run fr:multiple
 */

import {
  flowChart,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeFlowRecorder,
  SilentNarrativeFlowRecorder,
  type FlowRecorder,
} from 'footprint';

function buildLoopChart(iterations: number) {
  return flowChart('Init', async (scope: ScopeFacade) => {
    scope.setValue('counter', 0);
    scope.setValue('target', iterations);
  })
    .addFunction('Process', async (scope: ScopeFacade) => {
      const counter = scope.getValue('counter') as number;
      scope.setValue('counter', counter + 1);
      if (counter + 1 < (scope.getValue('target') as number)) {
        return { name: 'loop-back', next: { name: 'Process', id: 'Process' } };
      }
    }, 'Process')
    .build();
}

(async () => {

  // ── 1. Narrative + Metrics side-by-side ────────────────────────────────

  console.log('=== 1. Two Recorders: Narrative + Metrics ===\n');

  const silent = new SilentNarrativeFlowRecorder();
  const loopTimings: number[] = [];
  let lastTime = Date.now();

  const timingRecorder: FlowRecorder = {
    id: 'timing',
    onLoop: () => {
      const now = Date.now();
      loopTimings.push(now - lastTime);
      lastTime = now;
    },
  };

  let executor = new FlowChartExecutor(buildLoopChart(10));
  executor.attachFlowRecorder(silent);
  executor.attachFlowRecorder(timingRecorder);
  await executor.run();

  console.log('  Narrative (silent):');
  executor.getFlowNarrative().forEach((line) => console.log(`    ${line}`));
  console.log(`  Timing recorder captured: ${loopTimings.length} loop timings`);
  console.log();

  // ── 2. Recorder list management ────────────────────────────────────────

  console.log('=== 2. Attach / Detach / List ===\n');

  executor = new FlowChartExecutor(buildLoopChart(5));
  executor.attachFlowRecorder(new NarrativeFlowRecorder());
  executor.attachFlowRecorder({ id: 'audit', onLoop: () => {} });
  executor.attachFlowRecorder({ id: 'debug', onStageExecuted: () => {} });

  console.log(`  Attached: ${executor.getFlowRecorders().map(r => r.id).join(', ')}`);

  executor.detachFlowRecorder('debug');
  console.log(`  After detach('debug'): ${executor.getFlowRecorders().map(r => r.id).join(', ')}`);

  await executor.run();
  console.log(`  Narrative sentences: ${executor.getFlowNarrative().length}`);
  console.log();

  // ── 3. Error isolation ─────────────────────────────────────────────────

  console.log('=== 3. Error Isolation ===\n');

  const errorRecorder: FlowRecorder = {
    id: 'broken',
    onStageExecuted: () => { throw new Error('I crashed!'); },
    onLoop: () => { throw new Error('Loop crash!'); },
  };

  const goodRecorder = new NarrativeFlowRecorder();

  executor = new FlowChartExecutor(buildLoopChart(5));
  executor.attachFlowRecorder(errorRecorder);
  executor.attachFlowRecorder(goodRecorder);
  await executor.run();

  console.log('  Broken recorder threw errors, but execution continued.');
  console.log(`  Good recorder captured: ${executor.getFlowNarrative().length} sentences`);
  executor.getFlowNarrative().forEach((line) => console.log(`    ${line}`));

})().catch(console.error);
