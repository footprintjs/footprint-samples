/**
 * FlowRecorder: Simple Observer
 *
 * The simplest possible FlowRecorder — an object with `id` and a few hooks.
 * Demonstrates that FlowRecorders observe control flow events without
 * modifying execution behavior.
 *
 * Run:  npm run fr:simple
 * Try it: https://footprintjs.github.io/footprint-playground/samples/simple-observer
 */

import {
  flowChart,
  FlowChartExecutor,
  ScopeFacade,
  type FlowRecorder,
} from 'footprint';

(async () => {

// ── Build a simple linear chart ──────────────────────────────────────────

const chart = flowChart('Validate', async (scope: ScopeFacade) => {
  scope.setValue('input', 'hello');
  scope.setValue('valid', true);
}, 'validate')
  .addFunction('Process', async (scope: ScopeFacade) => {
    const input = scope.getValue('input') as string;
    scope.setValue('result', input.toUpperCase());
  }, 'process')
  .addFunction('Output', async (scope: ScopeFacade) => {
    const result = scope.getValue('result');
    scope.setValue('output', `Done: ${result}`);
  }, 'output')
  .build();

// ── Attach a simple FlowRecorder ─────────────────────────────────────────

const events: string[] = [];

const observer: FlowRecorder = {
  id: 'simple-observer',
  onStageExecuted: (event) => {
    events.push(`Stage executed: ${event.stageName}`);
  },
  onNext: (event) => {
    events.push(`  → moved from ${event.from} to ${event.to}`);
  },
};

const executor = new FlowChartExecutor(chart);
executor.attachFlowRecorder(observer);
await executor.run();

console.log('=== Simple FlowRecorder Observer ===\n');
events.forEach((line) => console.log(`  ${line}`));
console.log(`\n  Total events captured: ${events.length}`);

})().catch(console.error);
