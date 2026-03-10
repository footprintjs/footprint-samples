/**
 * Flowchart: Fork (Parallel Branches)
 *
 * Fork runs multiple branches in parallel, then continues.
 *
 *       ┌─ BranchA ─┐
 *   A ──┤            ├── D
 *       └─ BranchB ─┘
 *
 * Run:  npm run flow:fork
 */

import {
  FlowChartBuilder,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeRecorder,
  CombinedNarrativeBuilder,
} from 'footprint';

(async () => {

const recorder = new NarrativeRecorder({ id: 'fork', detail: 'full' });

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('LoadOrder', async (scope: ScopeFacade) => {
    scope.setValue('orderId', 'ORD-001');
    scope.setValue('amount', 250);
  })
  .addListOfFunction([
    {
      id: 'CheckInventory',
      name: 'CheckInventory',
      fn: async (scope: ScopeFacade) => {
        const orderId = scope.getValue('orderId') as string;
        scope.setValue('inStock', true);
        scope.setValue('warehouse', 'WH-East');
      },
    },
    {
      id: 'CheckFraud',
      name: 'CheckFraud',
      fn: async (scope: ScopeFacade) => {
        const amount = scope.getValue('amount') as number;
        scope.setValue('fraudScore', amount > 1000 ? 0.8 : 0.1);
        scope.setValue('fraudCleared', amount <= 1000);
      },
    },
  ])
  .addFunction('FinalizeOrder', async (scope: ScopeFacade) => {
    const inStock = scope.getValue('inStock') as boolean;
    const cleared = scope.getValue('fraudCleared') as boolean;
    scope.setValue('status', inStock && cleared ? 'confirmed' : 'held');
  })
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

console.log('=== Fork (Parallel Branches) ===\n');
narrative.forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
