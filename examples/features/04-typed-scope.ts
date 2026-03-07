/**
 * Feature: Typed Scope with Zod
 *
 * Define your scope schema with Zod for type-safe getters.
 * The scope proxy validates types at runtime.
 *
 * Run:  npm run feature:typed-scope
 */

import { z } from 'zod';
import {
  defineScopeFromZod,
  FlowChartBuilder,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeRecorder,
  CombinedNarrativeBuilder,
} from 'footprint';

(async () => {

// ── Define scope schema ─────────────────────────────────────────────────

const PatientScope = defineScopeFromZod(
  z.object({
    patientName: z.string(),
    temperature: z.number(),
    unit: z.enum(['celsius', 'fahrenheit']),
    temperatureF: z.number().optional(),
    diagnosis: z.string().optional(),
  }),
);

// ── Stage functions use typed getters ───────────────────────────────────

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('Intake', async (scope: ScopeFacade) => {
    scope.setValue('patientName', 'Jane Doe');
    scope.setValue('temperature', 39.2);
    scope.setValue('unit', 'celsius');
  })
  .addFunction('ConvertTemp', async (scope: ScopeFacade) => {
    const temp = scope.getValue('temperature') as number;
    const unit = scope.getValue('unit') as string;
    if (unit === 'celsius') {
      scope.setValue('temperatureF', temp * 1.8 + 32);
    }
  })
  .addFunction('Diagnose', async (scope: ScopeFacade) => {
    const tempF = scope.getValue('temperatureF') as number;
    const name = scope.getValue('patientName') as string;
    const diagnosis = tempF > 100.4 ? 'Fever detected' : 'Normal';
    scope.setValue('diagnosis', `${name}: ${diagnosis} (${tempF.toFixed(1)}°F)`);
  })
  .build();

// ── Run with narrative ──────────────────────────────────────────────────

const recorder = new NarrativeRecorder({ id: 'patient', detail: 'full' });

const scopeFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(recorder);
  return scope;
};

const executor = new FlowChartExecutor(chart, scopeFactory);
await executor.run();

const flowNarrative = executor.getNarrative();
const combined = new CombinedNarrativeBuilder();
const narrative = combined.build(flowNarrative, recorder);

console.log('=== Typed Scope (Zod) ===\n');
narrative.forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
