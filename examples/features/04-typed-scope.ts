/**
 * Feature: Typed Scope with Zod
 *
 * Define your scope schema with Zod for type-safe getters.
 * The scope proxy validates types at runtime.
 *
 * Run:  npm run feature:typed-scope
 * Try it: https://footprintjs.github.io/footprint-playground/samples/typed-scope
 */

import { z } from 'zod';
import { defineScopeFromZod, FlowChartBuilder, FlowChartExecutor, ScopeFacade } from 'footprint';

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

// ── Stage functions ─────────────────────────────────────────────────────

const intake = async (scope: ScopeFacade) => {
  scope.setValue('patientName', 'Jane Doe');
  scope.setValue('temperature', 39.2);
  scope.setValue('unit', 'celsius');
};

const convertTemp = async (scope: ScopeFacade) => {
  const temp = scope.getValue('temperature') as number;
  const unit = scope.getValue('unit') as string;
  if (unit === 'celsius') {
    scope.setValue('temperatureF', temp * 1.8 + 32);
  }
};

const diagnose = async (scope: ScopeFacade) => {
  const tempF = scope.getValue('temperatureF') as number;
  const name = scope.getValue('patientName') as string;
  const diagnosis = tempF > 100.4 ? 'Fever detected' : 'Normal';
  scope.setValue('diagnosis', `${name}: ${diagnosis} (${tempF.toFixed(1)}°F)`);
};

// ── Flowchart ───────────────────────────────────────────────────────────

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('Intake', intake, 'intake')
  .addFunction('ConvertTemp', convertTemp, 'convert-temp')
  .addFunction('Diagnose', diagnose, 'diagnose')
  .build();

// ── Run ─────────────────────────────────────────────────────────────────

const executor = new FlowChartExecutor(chart);
await executor.run();

console.log('=== Typed Scope (Zod) ===\n');
executor.getNarrative().forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
