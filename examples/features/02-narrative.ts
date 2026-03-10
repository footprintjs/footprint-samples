/**
 * Feature: Auto-generated Narrative
 *
 * Every setValue/getValue call is observed by NarrativeRecorder.
 * Combined with control-flow narrative, you get a full causal trace
 * with zero manual descriptions.
 *
 * Run:  npm run feature:narrative
 */

import {
  flowChart,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeRecorder,
  CombinedNarrativeBuilder,
} from 'footprint';

(async () => {

const recorder = new NarrativeRecorder({ id: 'demo', detail: 'full' });

const chart = flowChart('Ingest', async (scope: ScopeFacade) => {
  scope.setValue('temperature', 38.5);
  scope.setValue('unit', 'celsius');
})
  .setEnableNarrative()
  .addFunction('Convert', async (scope: ScopeFacade) => {
    const temp = scope.getValue('temperature') as number;
    const unit = scope.getValue('unit') as string;
    if (unit === 'celsius') {
      scope.setValue('temperatureF', temp * 1.8 + 32);
      scope.setValue('converted', true);
    }
  })
  .addFunction('Classify', async (scope: ScopeFacade) => {
    const tempF = scope.getValue('temperatureF') as number;
    scope.setValue('status', tempF > 100.4 ? 'fever' : 'normal');
  })
  .build();

const scopeFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(recorder);
  return scope;
};

const executor = new FlowChartExecutor(chart, scopeFactory);
await executor.run();

const flowNarrative = executor.getFlowNarrative();
const combined = new CombinedNarrativeBuilder();
const narrative = combined.build(flowNarrative, recorder);

console.log('=== Auto-generated Narrative ===\n');
narrative.forEach((line) => console.log(`  ${line}`));
console.log('\nNo descriptions were written by hand.');
})().catch(console.error);
