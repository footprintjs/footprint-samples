/**
 * Demo: Loan Application Pipeline
 *
 * Full loan underwriting pipeline using TypedScope<T>.
 * Exported as a module — no IIFE, no console.log.
 * Imported by the demo app UI directly.
 *
 * Stages: ReceiveApplication → PullCreditReport → CalculateDTI
 *       → VerifyEmployment → AssessRisk → LoanDecision
 *         ├─ Approve
 *         ├─ Reject
 *         └─ ManualReview
 */

import { flowChart, FlowChartExecutor, decide } from 'footprint';

// ── Public types ────────────────────────────────────────────────────────────

export interface LoanApplication {
  applicantName: string;
  annualIncome: number;
  monthlyDebts: number;
  creditScore: number;
  employmentStatus: 'employed' | 'self-employed' | 'unemployed';
  employmentYears: number;
  loanAmount: number;
}

export interface LoanResult {
  decision: string;
  creditTier: string;
  dtiPercent: number;
  riskTier: string;
  riskFactors: string[];
  narrative: string[];
  narrativeEntries: unknown[];
  snapshot: Record<string, unknown>;
  runtimeSnapshot: unknown;
}

// ── Internal state ──────────────────────────────────────────────────────────

interface LoanState {
  applicantName: string;
  loanAmount: number;
  creditScore: number;
  creditTier: string;
  creditFlags: string[];
  monthlyIncome: number;
  dtiRatio: number;
  dtiPercent: number;
  dtiStatus: string;
  dtiFlags: string[];
  employmentStatus: string;
  employmentYears: number;
  employmentVerified: boolean;
  employmentFlags: string[];
  riskTier: string;
  riskFactors: string[];
  decision: string;
}

// ── Mock services ───────────────────────────────────────────────────────────

const creditBureau = {
  pullReport: (score: number) => {
    const tier =
      score >= 740 ? 'excellent'
      : score >= 670 ? 'good'
      : score >= 580 ? 'fair'
      : 'poor';
    return {
      tier,
      flags:
        tier === 'poor' ? ['poor credit history']
        : tier === 'fair' ? ['below-average credit']
        : [],
    };
  },
};

const employerVerification = {
  verify: (status: string, years: number) => ({
    verified: status !== 'unemployed',
    flags:
      status === 'unemployed' ? ['applicant is unemployed']
      : status === 'self-employed' && years < 2
        ? [`self-employed for only ${years} year(s)`]
      : [],
  }),
};

// ── Pipeline ────────────────────────────────────────────────────────────────

const chart = flowChart<LoanState>(
  'ReceiveApplication',
  async (scope) => {
    const { app } = scope.$getArgs<{ app: LoanApplication }>();
    scope.applicantName = app.applicantName;
    scope.loanAmount = app.loanAmount;
  },
  'receive-application',
  'Receive and validate the loan application',
)
  .addFunction(
    'PullCreditReport',
    async (scope) => {
      const { app } = scope.$getArgs<{ app: LoanApplication }>();
      await new Promise((r) => setTimeout(r, 40));
      const report = creditBureau.pullReport(app.creditScore);
      scope.creditScore = app.creditScore;
      scope.creditTier = report.tier;
      scope.creditFlags = report.flags;
    },
    'pull-credit-report',
    'Pull credit report and classify credit tier',
  )
  .addFunction(
    'CalculateDTI',
    async (scope) => {
      const { app } = scope.$getArgs<{ app: LoanApplication }>();
      const monthlyIncome = app.annualIncome / 12;
      const dtiRatio = Math.round((app.monthlyDebts / monthlyIncome) * 100) / 100;
      const dtiPercent = Math.round(dtiRatio * 100);
      scope.monthlyIncome = Math.round(monthlyIncome);
      scope.dtiRatio = dtiRatio;
      scope.dtiPercent = dtiPercent;
      scope.dtiStatus = dtiRatio > 0.43 ? 'excessive' : 'healthy';
      scope.dtiFlags =
        dtiRatio > 0.43 ? [`DTI at ${dtiPercent}% exceeds 43% threshold`] : [];
    },
    'calculate-dti',
    'Calculate debt-to-income ratio',
  )
  .addFunction(
    'VerifyEmployment',
    async (scope) => {
      const { app } = scope.$getArgs<{ app: LoanApplication }>();
      await new Promise((r) => setTimeout(r, 25));
      const result = employerVerification.verify(app.employmentStatus, app.employmentYears);
      scope.employmentStatus = app.employmentStatus;
      scope.employmentYears = app.employmentYears;
      scope.employmentVerified = result.verified;
      scope.employmentFlags = result.flags;
    },
    'verify-employment',
    'Verify employment status and history',
  )
  .addFunction(
    'AssessRisk',
    async (scope) => {
      const riskTier =
        !scope.employmentVerified ||
        scope.dtiStatus === 'excessive' ||
        scope.creditTier === 'poor'
          ? 'high'
          : 'low';
      scope.riskTier = riskTier;
      scope.riskFactors = [
        ...scope.creditFlags,
        ...scope.dtiFlags,
        ...scope.employmentFlags,
      ];
    },
    'assess-risk',
    'Evaluate all factors and determine risk tier',
  )
  .addDeciderFunction(
    'LoanDecision',
    (scope) => {
      return decide(
        scope,
        [
          { when: { riskTier: { eq: 'low' } }, then: 'approved', label: 'Low risk' },
          { when: { riskTier: { eq: 'high' } }, then: 'rejected', label: 'High risk' },
        ],
        'manual-review',
      );
    },
    'loan-decision',
    'Route to approval, rejection, or manual review based on risk tier',
  )
    .addFunctionBranch(
      'approved',
      'Approve',
      async (scope) => {
        scope.decision = `APPROVED — ${scope.applicantName} qualified for $${scope.loanAmount.toLocaleString()}`;
      },
      'Generate approval with loan terms',
    )
    .addFunctionBranch(
      'rejected',
      'Reject',
      async (scope) => {
        scope.decision = `REJECTED — ${scope.applicantName}: ${scope.riskFactors.join('; ')}`;
      },
      'Generate rejection with denial reasons',
    )
    .addFunctionBranch(
      'manual-review',
      'ManualReview',
      async (scope) => {
        scope.decision = `MANUAL REVIEW — ${scope.applicantName} flagged for human underwriter`;
      },
      'Flag for human underwriter review',
    )
    .setDefault('manual-review')
    .end()
  .build();

/** Build-time spec for visualization (equivalent to builder.toSpec()). */
export const flowchartSpec = chart.buildTimeStructure;

// ── Run function ────────────────────────────────────────────────────────────

export async function runLoanPipeline(app: LoanApplication): Promise<LoanResult> {
  const executor = new FlowChartExecutor(chart);
  executor.enableNarrative();
  await executor.run({ input: { app } });

  const narrative = executor.getNarrative() as string[];
  const narrativeEntries = executor.getNarrativeEntries();
  const runtimeSnapshot = executor.getSnapshot();
  const snapshot = runtimeSnapshot.sharedState as Record<string, unknown>;

  return {
    decision: snapshot.decision as string,
    creditTier: snapshot.creditTier as string,
    dtiPercent: snapshot.dtiPercent as number,
    riskTier: snapshot.riskTier as string,
    riskFactors: (snapshot.riskFactors as string[]) ?? [],
    narrative,
    narrativeEntries,
    snapshot,
    runtimeSnapshot,
  };
}
