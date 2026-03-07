/**
 * Flowchart: Decider (Conditional Branching)
 *
 * A decider function inspects scope and returns a branch key.
 * Only the matching branch executes.
 *
 *             ┌─ "premium"  → PremiumPath
 *   Classify ─┤─ "standard" → StandardPath
 *             └─ "trial"    → TrialPath    (default)
 *
 * Run:  npm run flow:decider
 */

import {
  FlowChartBuilder,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeRecorder,
  CombinedNarrativeBuilder,
} from 'footprint';

(async () => {

const recorder = new NarrativeRecorder({ id: 'decider', detail: 'full' });

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('LoadUser', async (scope: ScopeFacade) => {
    scope.setValue('user', { name: 'Charlie', plan: 'premium', spend: 500 });
  })
  .addDeciderFunction('ClassifyUser', ((scope: ScopeFacade): string => {
    const user = scope.getValue('user') as any;
    if (user.plan === 'premium' && user.spend > 100) return 'premium';
    if (user.plan === 'standard') return 'standard';
    return 'trial';
  }) as any)
    .addFunctionBranch('premium', 'PremiumPath', async (scope: ScopeFacade) => {
      scope.setValue('discount', 20);
      scope.setValue('message', 'Thank you for being a premium member!');
    })
    .addFunctionBranch('standard', 'StandardPath', async (scope: ScopeFacade) => {
      scope.setValue('discount', 5);
      scope.setValue('message', 'Consider upgrading to premium.');
    })
    .addFunctionBranch('trial', 'TrialPath', async (scope: ScopeFacade) => {
      scope.setValue('discount', 0);
      scope.setValue('message', 'Welcome! Explore our plans.');
    })
    .setDefault('trial')
    .end()
  .addFunction('ApplyDiscount', async (scope: ScopeFacade) => {
    const user = scope.getValue('user') as any;
    const discount = scope.getValue('discount') as number;
    const finalAmount = user.spend * (1 - discount / 100);
    scope.setValue('finalAmount', finalAmount);
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
  executor.getNarrative(),
  recorder,
);

console.log('=== Decider (Conditional Branching) ===\n');
narrative.forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
