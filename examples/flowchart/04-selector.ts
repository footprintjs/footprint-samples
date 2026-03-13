/**
 * Flowchart: Selector (Multi-Branch)
 *
 * A selector inspects scope and returns an array of branch IDs.
 * ALL matching branches execute in parallel (unlike decider, which picks one).
 *
 *                       ┌─ DiabetesScreening ──┐
 *   LoadPatient → Triage ┤─ HypertensionCheck ─┤─→ GenerateReport
 *                       └─ ObesityAssessment ──┘
 * Try it: https://footprintjs.github.io/footprint-playground/samples/selector
 */

import { FlowChartBuilder, FlowChartExecutor, ScopeFacade } from 'footprint';

(async () => {

// ── Mock Patient Database ───────────────────────────────────────────────

const patientDB = new Map([
  ['P-101', {
    name: 'Maria Garcia',
    age: 58,
    vitals: { bmi: 31.2, bloodPressure: '148/92', fastingGlucose: 128 },
    conditions: ['diabetes', 'hypertension'],
    medications: ['lisinopril', 'metformin'],
  }],
  ['P-202', {
    name: 'James Wilson',
    age: 34,
    vitals: { bmi: 23.1, bloodPressure: '118/76', fastingGlucose: 92 },
    conditions: [],
    medications: [],
  }],
]);

// ── Stage Functions ─────────────────────────────────────────────────────

const loadPatient = async (scope: ScopeFacade) => {
  const patient = patientDB.get('P-101')!;
  scope.setValue('patient', patient);
  scope.setValue('screeningResults', []);
};

const triageConditions = (scope: ScopeFacade): string[] => {
  const patient = scope.getValue('patient') as any;
  const selected: string[] = [];
  if (patient.vitals.fastingGlucose > 100) selected.push('diabetes');
  if (parseInt(patient.vitals.bloodPressure) > 140) selected.push('hypertension');
  if (patient.vitals.bmi > 30) selected.push('obesity');
  return selected;
};

const diabetesScreening = async (scope: ScopeFacade) => {
  const patient = scope.getValue('patient') as any;
  const glucose = patient.vitals.fastingGlucose;
  const risk = glucose > 126 ? 'high' : glucose > 100 ? 'moderate' : 'low';
  const results = scope.getValue('screeningResults') as any[];
  scope.setValue('screeningResults', [...results, {
    condition: 'Type 2 Diabetes',
    risk,
    detail: `Fasting glucose: ${glucose} mg/dL`,
    recommendation: risk === 'high' ? 'Schedule HbA1c test' : 'Recheck in 6 months',
  }]);
};

const hypertensionCheck = async (scope: ScopeFacade) => {
  const patient = scope.getValue('patient') as any;
  const bp = patient.vitals.bloodPressure;
  const systolic = parseInt(bp);
  const risk = systolic > 140 ? 'high' : systolic > 130 ? 'moderate' : 'low';
  const results = scope.getValue('screeningResults') as any[];
  scope.setValue('screeningResults', [...results, {
    condition: 'Hypertension',
    risk,
    detail: `Blood pressure: ${bp} mmHg`,
    recommendation: risk === 'high' ? 'Adjust medication dosage' : 'Monitor weekly',
  }]);
};

const obesityAssessment = async (scope: ScopeFacade) => {
  const patient = scope.getValue('patient') as any;
  const bmi = patient.vitals.bmi;
  const severity = bmi > 35 ? 'severe' : bmi > 30 ? 'moderate' : 'overweight';
  const results = scope.getValue('screeningResults') as any[];
  scope.setValue('screeningResults', [...results, {
    condition: 'Obesity',
    risk: severity,
    detail: `BMI: ${bmi}`,
    recommendation: 'Refer to nutritionist',
  }]);
};

const generateReport = async (scope: ScopeFacade) => {
  const patient = scope.getValue('patient') as any;
  const results = scope.getValue('screeningResults') as any[];
  console.log(`\n  Patient: ${patient.name} (age ${patient.age})`);
  results.forEach((r: any) => {
    console.log(`  • ${r.condition}: ${r.risk} risk — ${r.detail}`);
    console.log(`    → ${r.recommendation}`);
  });
  scope.setValue('reportGenerated', true);
};

// ── Flowchart ───────────────────────────────────────────────────────────

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('LoadPatient', loadPatient, 'load-patient')
  .addSelectorFunction('Triage', triageConditions as any, 'triage')
    .addFunctionBranch('diabetes', 'DiabetesScreening', diabetesScreening)
    .addFunctionBranch('hypertension', 'HypertensionCheck', hypertensionCheck)
    .addFunctionBranch('obesity', 'ObesityAssessment', obesityAssessment)
    .end()
  .addFunction('GenerateReport', generateReport, 'generate-report')
  .build();

// ── Run ─────────────────────────────────────────────────────────────────

const executor = new FlowChartExecutor(chart);
await executor.run();

console.log('\n=== Selector (Multi-Branch Screening) ===\n');
executor.getNarrative().forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
