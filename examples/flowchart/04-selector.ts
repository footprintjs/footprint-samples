/**
 * Flowchart: Selector (Multi-Branch)
 *
 * A selector function inspects scope and returns an array of branch IDs.
 * ALL matching branches execute in parallel (unlike decider which picks one).
 *
 * Run:  npm run flow:selector
 */

import {
  FlowChartBuilder,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeRecorder,
  CombinedNarrativeBuilder,
} from 'footprint';

(async () => {

const recorder = new NarrativeRecorder({ id: 'selector', detail: 'full' });

// The selector function reads scope and returns branch IDs to execute
const screenConditions = (scope: ScopeFacade): string[] => {
  const patient = scope.getValue('patient') as any;
  const selected: string[] = [];

  if (patient.conditions.includes('diabetes')) selected.push('diabetes');
  if (patient.conditions.includes('hypertension')) selected.push('hypertension');
  if (patient.bmi >= 30) selected.push('obesity');

  return selected;
};

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('LoadPatient', async (scope: ScopeFacade) => {
    scope.setValue('patient', {
      name: 'Dana',
      age: 68,
      conditions: ['diabetes', 'hypertension'],
      bmi: 31,
    });
  })
  .addSelectorFunction('ScreenConditions', screenConditions as any)
    .addFunctionBranch('diabetes', 'DiabetesProtocol', async (scope: ScopeFacade) => {
      scope.setValue('diabetesAlert', 'Check HbA1c levels');
    })
    .addFunctionBranch('hypertension', 'HypertensionProtocol', async (scope: ScopeFacade) => {
      scope.setValue('bpAlert', 'Monitor blood pressure daily');
    })
    .addFunctionBranch('obesity', 'ObesityProtocol', async (scope: ScopeFacade) => {
      scope.setValue('weightAlert', 'Recommend dietary consultation');
    })
  .end()
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

console.log('=== Selector (Multi-Branch) ===\n');
narrative.forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
