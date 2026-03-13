/**
 * Feature: Auto-generated Narrative
 *
 * Call setEnableNarrative() on the builder. The library automatically
 * observes every setValue/getValue and merges it with control-flow events.
 * Call executor.getNarrative() to get the full causal trace — zero setup.
 *
 * Run:  npm run feature:narrative
 * Try it: https://footprintjs.github.io/footprint-playground/samples/narrative
 */

import { flowChart, FlowChartExecutor, ScopeFacade } from 'footprint';

(async () => {

const chart = flowChart('Ingest', async (scope: ScopeFacade) => {
  scope.setValue('temperature', 38.5);
  scope.setValue('unit', 'celsius');
}, 'ingest')
  .setEnableNarrative()
  .addFunction('Convert', async (scope: ScopeFacade) => {
    const temp = scope.getValue('temperature') as number;
    const unit = scope.getValue('unit') as string;
    if (unit === 'celsius') {
      scope.setValue('temperatureF', temp * 1.8 + 32);
      scope.setValue('converted', true);
    }
  }, 'convert')
  .addFunction('Classify', async (scope: ScopeFacade) => {
    const tempF = scope.getValue('temperatureF') as number;
    scope.setValue('status', tempF > 100.4 ? 'fever' : 'normal');
  }, 'classify')
  .build();

const executor = new FlowChartExecutor(chart);
await executor.run();

console.log('=== Auto-generated Narrative ===\n');
executor.getNarrative().forEach((line) => console.log(`  ${line}`));
console.log('\nNo descriptions were written by hand.');
console.log('No NarrativeRecorder, no scopeFactory, no CombinedNarrativeBuilder.');
console.log('Just setEnableNarrative() + getNarrative().');
})().catch(console.error);
