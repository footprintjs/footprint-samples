/**
 * Quick Start — Loan Application
 *
 * A complete loan underwriting pipeline that demonstrates:
 * - Setting objects and primitives via scope
 * - Auto-generated narrative trace
 * - Decider-based branching
 * - Combined narrative output for LLM consumption
 *
 * Run:  npm run quick-start
 */

import {
  FlowChartBuilder,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeRecorder,
  CombinedNarrativeBuilder,
} from 'footprint';

(async () => {

// ── Application data ────────────────────────────────────────────────────

const app = {
  applicantName: 'Bob Martinez',
  annualIncome: 42_000,
  monthlyDebts: 2_100,
  creditScore: 580,
  employmentStatus: 'self-employed' as const,
  employmentYears: 1,
  loanAmount: 40_000,
};

// ── Stage functions ─────────────────────────────────────────────────────

const receiveApplication = async (scope: ScopeFacade) => {
  scope.setValue('app', app);
};

const pullCreditReport = async (scope: ScopeFacade) => {
  const { creditScore } = scope.getValue('app') as typeof app;
  await new Promise((r) => setTimeout(r, 40)); // simulate credit bureau API call
  const tier =
    creditScore >= 740
      ? 'excellent'
      : creditScore >= 670
        ? 'good'
        : creditScore >= 580
          ? 'fair'
          : 'poor';
  scope.setValue('creditTier', tier);
  scope.setValue('creditFlags', tier === 'fair' ? ['below-average credit'] : []);
};

const calculateDTI = async (scope: ScopeFacade) => {
  const { annualIncome, monthlyDebts } = scope.getValue('app') as typeof app;
  const dtiRatio = Math.round((monthlyDebts / (annualIncome / 12)) * 100) / 100;
  scope.setValue('dtiRatio', dtiRatio);
  scope.setValue('dtiPercent', Math.round(dtiRatio * 100));
  scope.setValue('dtiStatus', dtiRatio > 0.43 ? 'excessive' : 'healthy');
  scope.setValue(
    'dtiFlags',
    dtiRatio > 0.43 ? [`DTI at ${Math.round(dtiRatio * 100)}% exceeds 43%`] : [],
  );
};

const verifyEmployment = async (scope: ScopeFacade) => {
  await new Promise((r) => setTimeout(r, 25)); // simulate employer verification
  const { employmentStatus, employmentYears } = scope.getValue('app') as typeof app;
  const verified = employmentStatus !== 'unemployed';
  scope.setValue('employmentVerified', verified);
  scope.setValue(
    'employmentFlags',
    employmentStatus === 'self-employed' && employmentYears < 2
      ? [`Self-employed for only ${employmentYears} year(s)`]
      : [],
  );
};

const assessRisk = async (scope: ScopeFacade) => {
  const creditTier = scope.getValue('creditTier') as string;
  const dtiStatus = scope.getValue('dtiStatus') as string;
  const verified = scope.getValue('employmentVerified') as boolean;

  const riskTier =
    !verified || dtiStatus === 'excessive' || creditTier === 'poor' ? 'high' : 'low';
  scope.setValue('riskTier', riskTier);

  const flags = [
    ...(scope.getValue('creditFlags') as string[]),
    ...(scope.getValue('dtiFlags') as string[]),
    ...(scope.getValue('employmentFlags') as string[]),
  ];
  scope.setValue('riskFactors', flags);
};

const loanDecider = (scope: ScopeFacade): string => {
  const tier = scope.getValue('riskTier') as string;
  return tier === 'low' ? 'approved' : tier === 'high' ? 'rejected' : 'manual-review';
};

const approveApplication = async (scope: ScopeFacade) => {
  const { applicantName } = scope.getValue('app') as typeof app;
  scope.setValue('decision', `${applicantName}: APPROVED`);
};

const rejectApplication = async (scope: ScopeFacade) => {
  const { applicantName } = scope.getValue('app') as typeof app;
  const factors = scope.getValue('riskFactors') as string[];
  scope.setValue('decision', `${applicantName}: REJECTED — ${factors.join('; ')}`);
};

const manualReview = async (scope: ScopeFacade) => {
  const { applicantName } = scope.getValue('app') as typeof app;
  scope.setValue('decision', `${applicantName}: SENT TO MANUAL REVIEW`);
};

// ── Build the flow ──────────────────────────────────────────────────────

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('ReceiveApplication', receiveApplication)
  .addFunction('PullCreditReport', pullCreditReport)
  .addFunction('CalculateDTI', calculateDTI)
  .addFunction('VerifyEmployment', verifyEmployment)
  .addFunction('AssessRisk', assessRisk)
  .addDeciderFunction('LoanDecision', loanDecider as any)
    .addFunctionBranch('approved', 'ApproveApplication', approveApplication)
    .addFunctionBranch('rejected', 'RejectApplication', rejectApplication)
    .addFunctionBranch('manual-review', 'ManualReview', manualReview)
    .setDefault('manual-review')
    .end()
  .build();

// ── Instrument with NarrativeRecorder ───────────────────────────────────

const recorder = new NarrativeRecorder({ id: 'loan', detail: 'full' });

const scopeFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(recorder);
  return scope;
};

// ── Run ─────────────────────────────────────────────────────────────────

const executor = new FlowChartExecutor(chart, scopeFactory);
await executor.run();

// ── Print the causal trace ──────────────────────────────────────────────

const flowNarrative = executor.getNarrative();
const combined = new CombinedNarrativeBuilder();
const narrative = combined.build(flowNarrative, recorder);

console.log('=== Loan Application — Causal Trace ===\n');
narrative.forEach((line) => console.log(`  ${line}`));
console.log();
})().catch(console.error);
