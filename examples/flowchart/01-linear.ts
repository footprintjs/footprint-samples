/**
 * Flowchart: Linear Pipeline
 *
 * The simplest flow — stages execute one after another.
 *
 *   A → B → C
 *
 * Run:  npm run flow:linear
 */

import {
  flowChart,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeRecorder,
  CombinedNarrativeBuilder,
} from 'footprint';

(async () => {

const recorder = new NarrativeRecorder({ id: 'linear', detail: 'full' });

const chart = flowChart('FetchUser', async (scope: ScopeFacade) => {
  scope.setValue('userId', 42);
  scope.setValue('username', 'alice');
})
  .setEnableNarrative()
  .addFunction('EnrichProfile', async (scope: ScopeFacade) => {
    const username = scope.getValue('username') as string;
    scope.setValue('displayName', username.charAt(0).toUpperCase() + username.slice(1));
    scope.setValue('role', 'admin');
  })
  .addFunction('FormatOutput', async (scope: ScopeFacade) => {
    const displayName = scope.getValue('displayName') as string;
    const role = scope.getValue('role') as string;
    scope.setValue('greeting', `Welcome back, ${displayName} (${role})!`);
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

console.log('=== Linear Pipeline ===\n');
narrative.forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
