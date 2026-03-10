/**
 * Flowchart: Loops (loopTo + breakFn)
 *
 * Use `.loopTo(stageId)` to jump back to an earlier stage.
 * Call `breakFn()` inside a stage to exit the loop.
 *
 *   Increment ←──┐
 *       │        │
 *   CheckLimit ──┘  (loops back until counter reaches target)
 *
 * Run:  npm run flow:loops
 */

import {
  flowChart,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeRecorder,
  CombinedNarrativeBuilder,
} from 'footprint';

(async () => {

const recorder = new NarrativeRecorder({ id: 'loops', detail: 'full' });

const chart = flowChart('Init', async (scope: ScopeFacade) => {
  scope.setValue('counter', 0);
  scope.setValue('target', 3);
})
  .setEnableNarrative()
  .addFunction(
    'Increment',
    async (scope: ScopeFacade) => {
      const counter = scope.getValue('counter') as number;
      scope.setValue('counter', counter + 1);
    },
  )
  .addFunction(
    'CheckLimit',
    async (scope: ScopeFacade, breakFn: () => void) => {
      const counter = scope.getValue('counter') as number;
      const target = scope.getValue('target') as number;

      if (counter >= target) {
        scope.setValue('done', true);
        breakFn();
      }
    },
  )
  .loopTo('Increment')
  .build();

const scopeFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(recorder);
  return scope;
};

const executor = new FlowChartExecutor(chart, scopeFactory);
await executor.run();

const narrative = new CombinedNarrativeBuilder().build(
  executor.getFlowNarrative(),
  recorder,
);

console.log('=== Loops (loopTo + breakFn) ===\n');
narrative.forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
