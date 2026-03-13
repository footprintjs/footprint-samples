/**
 * Quick Start — Loan Application
 *
 * A complete loan underwriting pipeline that demonstrates:
 * - Reading input via getArgs() (readonly, frozen, shared across all stages)
 * - Writing computed values via setValue() (stage-produced data)
 * - Auto-generated narrative trace (setEnableNarrative + getNarrative)
 * - Decider-based branching
 *
 * In the playground, edit the INPUT panel (bottom-left) to change applicant data.
 * Try it: https://footprintjs.github.io/footprint-playground/samples/loan-application
 */

import { FlowChartBuilder, FlowChartExecutor, ScopeFacade } from 'footprint';

(async () => {

// ── Input ───────────────────────────────────────────────────────────────
// In the playground, INPUT is provided via the JSON input panel.
// When running standalone, define it here as a fallback.

interface LoanApplication {
  applicantName: string;
  annualIncome: number;
  monthlyDebts: number;
  creditScore: number;
  employmentStatus: 'employed' | 'self-employed' | 'unemployed';
  employmentYears: number;
  loanAmount: number;
}

interface LoanInput {
  app: LoanApplication;
}

const input: LoanInput = (typeof INPUT !== 'undefined' && INPUT) || {
  app: {
    applicantName: 'Bob Martinez',
    annualIncome: 42_000,
    monthlyDebts: 2_100,
    creditScore: 580,
    employmentStatus: 'self-employed',
    employmentYears: 1,
    loanAmount: 40_000,
  },
};

// ── Mock Services ───────────────────────────────────────────────────────

const creditBureau = {
  pullReport: (score: number) => {
    const tier =
      score >= 740 ? 'excellent'
        : score >= 670 ? 'good'
          : score >= 580 ? 'fair'
            : 'poor';
    return {
      tier,
      flags: tier === 'fair' ? ['below-average credit'] : [],
    };
  },
};

const employerVerification = {
  verify: (status: string, years: number) => ({
    verified: status !== 'unemployed',
    flags:
      status === 'self-employed' && years < 2
        ? [`Self-employed for only ${years} year(s)`]
        : [],
  }),
};

// ── Stage Functions ─────────────────────────────────────────────────────

const receiveApplication = async (scope: ScopeFacade) => {
  const { app } = scope.getArgs<LoanInput>();
  console.log(`  Received application from ${app.applicantName}`);
};

const pullCreditReport = async (scope: ScopeFacade) => {
  const { app } = scope.getArgs<LoanInput>();
  await new Promise((r) => setTimeout(r, 40)); // simulate credit bureau API
  const report = creditBureau.pullReport(app.creditScore);
  scope.setValue('creditTier', report.tier);
  scope.setValue('creditFlags', report.flags);
};

const calculateDTI = async (scope: ScopeFacade) => {
  const { app } = scope.getArgs<LoanInput>();
  const dtiRatio = Math.round((app.monthlyDebts / (app.annualIncome / 12)) * 100) / 100;
  scope.setValue('dtiRatio', dtiRatio);
  scope.setValue('dtiPercent', Math.round(dtiRatio * 100));
  scope.setValue('dtiStatus', dtiRatio > 0.43 ? 'excessive' : 'healthy');
  scope.setValue(
    'dtiFlags',
    dtiRatio > 0.43 ? [`DTI at ${Math.round(dtiRatio * 100)}% exceeds 43%`] : [],
  );
};

const verifyEmployment = async (scope: ScopeFacade) => {
  const { app } = scope.getArgs<LoanInput>();
  await new Promise((r) => setTimeout(r, 25)); // simulate employer verification
  const result = employerVerification.verify(app.employmentStatus, app.employmentYears);
  scope.setValue('employmentVerified', result.verified);
  scope.setValue('employmentFlags', result.flags);
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
  const { app } = scope.getArgs<LoanInput>();
  scope.setValue('decision', `${app.applicantName}: APPROVED`);
};

const rejectApplication = async (scope: ScopeFacade) => {
  const { app } = scope.getArgs<LoanInput>();
  const factors = scope.getValue('riskFactors') as string[];
  scope.setValue('decision', `${app.applicantName}: REJECTED — ${factors.join('; ')}`);
};

const manualReview = async (scope: ScopeFacade) => {
  const { app } = scope.getArgs<LoanInput>();
  scope.setValue('decision', `${app.applicantName}: SENT TO MANUAL REVIEW`);
};

// ── Flowchart ───────────────────────────────────────────────────────────

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('ReceiveApplication', receiveApplication, 'receive-application',
    'Ingest the loan application and store applicant data')
  .addFunction('PullCreditReport', pullCreditReport, 'pull-credit-report',
    'Retrieve credit score and flag any credit issues')
  .addFunction('CalculateDTI', calculateDTI, 'calculate-dti',
    'Compute debt-to-income ratio and flag excessive debt')
  .addFunction('VerifyEmployment', verifyEmployment, 'verify-employment',
    'Confirm employment status and years of experience')
  .addFunction('AssessRisk', assessRisk, 'assess-risk',
    'Evaluate all flags and credit data to determine risk tier')
  .addDeciderFunction('LoanDecision', loanDecider as any, 'loan-decision',
    'Route to approval, rejection, or manual review based on risk tier')
    .addFunctionBranch('approved', 'ApproveApplication', approveApplication,
      'Generate approval letter with loan terms')
    .addFunctionBranch('rejected', 'RejectApplication', rejectApplication,
      'Generate rejection notice with denial reasons')
    .addFunctionBranch('manual-review', 'ManualReview', manualReview,
      'Flag for human underwriter review with risk summary')
    .setDefault('manual-review')
    .end()
  .build();

// ── Run ─────────────────────────────────────────────────────────────────

const executor = new FlowChartExecutor(chart);
await executor.run({ input });

console.log('=== Loan Application — Causal Trace ===\n');
executor.getNarrative().forEach((line) => console.log(`  ${line}`));
console.log();
})().catch(console.error);
