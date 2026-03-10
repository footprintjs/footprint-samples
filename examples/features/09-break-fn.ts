/**
 * Feature: breakFn — Early Pipeline Termination
 *
 * Every stage function receives `breakFn` as its second parameter.
 * Calling breakFn() stops the pipeline after the current stage completes.
 * The stage's writes are committed, but no further stages execute.
 *
 * Use cases:
 * - Validation gates (stop if input is invalid)
 * - Early exits (goal already reached, skip remaining work)
 * - Safety limits (cost/token budget exceeded)
 *
 * Run:  npm run feature:break
 */

import {
  FlowChartBuilder,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeRecorder,
  CombinedNarrativeBuilder,
} from 'footprint';

(async () => {

const recorder = new NarrativeRecorder({ id: 'break', detail: 'full' });

// ── Scenario 1: Validation gate — stop pipeline on bad input ────────────

console.log('=== Scenario 1: Validation Gate ===\n');

const validationChart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('ValidateInput', async (scope: ScopeFacade, breakFn: () => void) => {
    const amount = 75_000;
    scope.setValue('amount', amount);
    scope.setValue('currency', 'USD');

    if (amount > 50_000) {
      scope.setValue('rejected', true);
      scope.setValue('reason', `Amount $${amount.toLocaleString()} exceeds $50,000 limit`);
      breakFn(); // ← stop here, don't process further
    }
  })
  .addFunction('ProcessPayment', async (scope: ScopeFacade) => {
    // This never runs when breakFn is called
    scope.setValue('processed', true);
    scope.setValue('transactionId', 'TXN-' + Date.now());
  })
  .addFunction('SendConfirmation', async (scope: ScopeFacade) => {
    // This never runs either
    scope.setValue('emailSent', true);
  })
  .build();

const scopeFactory1 = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(recorder);
  return scope;
};

const executor1 = new FlowChartExecutor(validationChart, scopeFactory1);
await executor1.run();

const narrative1 = new CombinedNarrativeBuilder().build(
  executor1.getFlowNarrative(),
  recorder,
);

narrative1.forEach((line) => console.log(`  ${line}`));
console.log('\n  ProcessPayment and SendConfirmation never ran.\n');

// ── Scenario 2: Budget limit — stop when cost threshold is reached ──────

console.log('=== Scenario 2: Budget Limit ===\n');

const recorder2 = new NarrativeRecorder({ id: 'budget', detail: 'full' });

const budgetChart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('Init', async (scope: ScopeFacade) => {
    scope.setValue('budget', 100);
    scope.setValue('spent', 0);
    scope.setValue('items', [] as string[]);
  })
  .addFunction('BuyItem1', async (scope: ScopeFacade, breakFn: () => void) => {
    const spent = (scope.getValue('spent') as number) + 30;
    scope.setValue('spent', spent);
    const items = scope.getValue('items') as string[];
    scope.setValue('items', [...items, 'Widget A ($30)']);

    if (spent >= (scope.getValue('budget') as number)) {
      scope.setValue('budgetExhausted', true);
      breakFn();
    }
  })
  .addFunction('BuyItem2', async (scope: ScopeFacade, breakFn: () => void) => {
    const spent = (scope.getValue('spent') as number) + 45;
    scope.setValue('spent', spent);
    const items = scope.getValue('items') as string[];
    scope.setValue('items', [...items, 'Widget B ($45)']);

    if (spent >= (scope.getValue('budget') as number)) {
      scope.setValue('budgetExhausted', true);
      breakFn();
    }
  })
  .addFunction('BuyItem3', async (scope: ScopeFacade, breakFn: () => void) => {
    const spent = (scope.getValue('spent') as number) + 50;
    scope.setValue('spent', spent);
    const items = scope.getValue('items') as string[];
    scope.setValue('items', [...items, 'Widget C ($50)']);

    if (spent >= (scope.getValue('budget') as number)) {
      scope.setValue('budgetExhausted', true);
      breakFn();
    }
  })
  .addFunction('BuyItem4', async (scope: ScopeFacade) => {
    // This won't run — budget exhausted at Item 3
    const items = scope.getValue('items') as string[];
    scope.setValue('items', [...items, 'Widget D ($25)']);
  })
  .build();

const scopeFactory2 = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(recorder2);
  return scope;
};

const executor2 = new FlowChartExecutor(budgetChart, scopeFactory2);
await executor2.run();

const narrative2 = new CombinedNarrativeBuilder().build(
  executor2.getFlowNarrative(),
  recorder2,
);

narrative2.forEach((line) => console.log(`  ${line}`));
console.log('\n  BuyItem4 never ran — budget of $100 reached at $125.\n');

})().catch(console.error);
