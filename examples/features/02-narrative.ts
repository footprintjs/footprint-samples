/**
 * Feature: Auto-generated Narrative
 *
 * Call setEnableNarrative() on the builder. The library automatically
 * observes every read/write and merges it with control-flow events.
 * Call executor.getNarrative() to get the full causal trace — zero setup.
 *
 * Run:  npm run feature:narrative
 * Try it: https://footprintjs.github.io/footprint-playground/samples/narrative
 */

import {
  typedFlowChart,
  FlowChartExecutor,
} from 'footprint';

interface TempState {
  temperature: number;
  unit: string;
  temperatureF?: number;
  converted?: boolean;
  status?: string;
}

(async () => {

const chart = typedFlowChart<TempState>('Ingest', async (scope) => {
  scope.temperature = 38.5;
  scope.unit = 'celsius';
}, 'ingest')
  .setEnableNarrative()
  .addFunction('Convert', async (scope) => {
    if (scope.unit === 'celsius') {
      scope.temperatureF = scope.temperature * 1.8 + 32;
      scope.converted = true;
    }
  }, 'convert')
  .addFunction('Classify', async (scope) => {
    scope.status = scope.temperatureF! > 100.4 ? 'fever' : 'normal';
  }, 'classify')
  .build();

const executor = new FlowChartExecutor(chart);
await executor.run();

console.log('=== Auto-generated Narrative ===\n');
executor.getNarrative().forEach((line) => console.log(`  ${line}`));
console.log('\nNo casts, no scopeFactory boilerplate.');
console.log('Just typedFlowChart<T>() + setEnableNarrative() + getNarrative().');
})().catch(console.error);
