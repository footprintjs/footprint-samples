/**
 * Integration test: Loan Application (quick-start/loan-application)
 *
 * The flagship end-to-end test. Verifies that the full underwriting pipeline
 * produces correct decisions and evidence-aware narrative for multiple applicants.
 *
 * This is the "canary" — if the library regresses, this breaks first.
 */
import { describe, it, expect } from 'vitest';
import { flowChart, FlowChartExecutor, decide } from 'footprint';

// ── Types ─────────────────────────────────────────────────────────────────

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

interface LoanState {
  creditTier: string;
  creditFlags: string[];
  dtiRatio: number;
  dtiPercent: number;
  dtiStatus: string;
  dtiFlags: string[];
  employmentVerified: boolean;
  employmentFlags: string[];
  riskTier: string;
  riskFactors: string[];
  decision: string;
}

// ── Mock services ─────────────────────────────────────────────────────────

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

// ── Chart factory ─────────────────────────────────────────────────────────

function buildLoanChart() {
  return flowChart<LoanState>('ReceiveApplication', async (scope) => {
    // No-op: just marks the start
  }, 'receive-application', undefined, 'Ingest the loan application')
    .addFunction('PullCreditReport', async (scope) => {
      const { app } = scope.$getArgs<LoanInput>();
      const report = creditBureau.pullReport(app.creditScore);
      scope.creditTier = report.tier;
      scope.creditFlags = report.flags;
    }, 'pull-credit-report', 'Retrieve credit score')
    .addFunction('CalculateDTI', async (scope) => {
      const { app } = scope.$getArgs<LoanInput>();
      const dtiRatio = Math.round((app.monthlyDebts / (app.annualIncome / 12)) * 100) / 100;
      scope.dtiRatio = dtiRatio;
      scope.dtiPercent = Math.round(dtiRatio * 100);
      scope.dtiStatus = dtiRatio > 0.43 ? 'excessive' : 'healthy';
      scope.dtiFlags =
        dtiRatio > 0.43 ? [`DTI at ${Math.round(dtiRatio * 100)}% exceeds 43%`] : [];
    }, 'calculate-dti', 'Compute debt-to-income ratio')
    .addFunction('VerifyEmployment', async (scope) => {
      const { app } = scope.$getArgs<LoanInput>();
      const result = employerVerification.verify(app.employmentStatus, app.employmentYears);
      scope.employmentVerified = result.verified;
      scope.employmentFlags = result.flags;
    }, 'verify-employment', 'Confirm employment status')
    .addFunction('AssessRisk', async (scope) => {
      const riskTier =
        !scope.employmentVerified || scope.dtiStatus === 'excessive' || scope.creditTier === 'poor'
          ? 'high' : 'low';
      scope.riskTier = riskTier;
      scope.riskFactors = [
        ...scope.creditFlags,
        ...scope.dtiFlags,
        ...scope.employmentFlags,
      ];
    }, 'assess-risk', 'Evaluate risk tier')
    .addDeciderFunction('LoanDecision', (scope) => {
      return decide(scope, [
        { when: { riskTier: { eq: 'low' } }, then: 'approved', label: 'Low risk' },
        { when: { riskTier: { eq: 'high' } }, then: 'rejected', label: 'High risk' },
      ], 'manual-review');
    }, 'loan-decision', 'Route to approval or rejection')
    .addFunctionBranch('approved', 'ApproveApplication', async (scope) => {
      const { app } = scope.$getArgs<LoanInput>();
      scope.decision = `${app.applicantName}: APPROVED`;
    }, 'Generate approval')
    .addFunctionBranch('rejected', 'RejectApplication', async (scope) => {
      const { app } = scope.$getArgs<LoanInput>();
      scope.decision = `${app.applicantName}: REJECTED — ${scope.riskFactors.join('; ')}`;
    }, 'Generate rejection')
    .addFunctionBranch('manual-review', 'ManualReview', async (scope) => {
      const { app } = scope.$getArgs<LoanInput>();
      scope.decision = `${app.applicantName}: SENT TO MANUAL REVIEW`;
    }, 'Flag for review')
    .setDefault('manual-review')
    .end()
    .build();
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Loan Application — quick-start', () => {

  it('low-risk applicant gets approved — narrative matches snapshot', async () => {
    const input: LoanInput = {
      app: {
        applicantName: 'Alice Chen',
        annualIncome: 120_000,
        monthlyDebts: 1_500,
        creditScore: 780,
        employmentStatus: 'employed',
        employmentYears: 8,
        loanAmount: 30_000,
      },
    };

    const chart = buildLoanChart();
    const executor = new FlowChartExecutor(chart);
    executor.enableNarrative();
    await executor.run({ input });

    const narrative = executor.getNarrative();
    expect(narrative).toMatchSnapshot();
    // Decision evidence: filter rule with eq operator
    expect(narrative.some(l => l.includes('Low risk'))).toBe(true);
    expect(narrative.some(l => l.includes('ApproveApplication'))).toBe(true);
    expect(narrative.some(l => l.includes('eq') && l.includes('low'))).toBe(true);
  });

  it('high-risk applicant gets rejected with reason list — narrative matches snapshot', async () => {
    const input: LoanInput = {
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

    const chart = buildLoanChart();
    const executor = new FlowChartExecutor(chart);
    executor.enableNarrative();
    await executor.run({ input });

    const narrative = executor.getNarrative();
    expect(narrative).toMatchSnapshot();
    // High risk path
    expect(narrative.some(l => l.includes('High risk'))).toBe(true);
    expect(narrative.some(l => l.includes('RejectApplication'))).toBe(true);
    expect(narrative.some(l => l.includes('eq') && l.includes('high'))).toBe(true);
  });

  it('unemployed applicant: decision evidence shows riskTier eq high', async () => {
    const input: LoanInput = {
      app: {
        applicantName: 'Carol Smith',
        annualIncome: 60_000,
        monthlyDebts: 800,
        creditScore: 720,
        employmentStatus: 'unemployed',
        employmentYears: 0,
        loanAmount: 20_000,
      },
    };

    const chart = buildLoanChart();
    const executor = new FlowChartExecutor(chart);
    executor.enableNarrative();
    await executor.run({ input });

    const snapshot = executor.getSnapshot();
    expect((snapshot.sharedState as any).riskTier).toBe('high');
    expect((snapshot.sharedState as any).employmentVerified).toBe(false);
    const narrative = executor.getNarrative();
    expect(narrative.some(l => l.includes('RejectApplication'))).toBe(true);
  });

  it('final state has expected shape after full pipeline', async () => {
    const input: LoanInput = {
      app: {
        applicantName: 'Dave Lee',
        annualIncome: 90_000,
        monthlyDebts: 1_000,
        creditScore: 740,
        employmentStatus: 'employed',
        employmentYears: 5,
        loanAmount: 25_000,
      },
    };

    const chart = buildLoanChart();
    const executor = new FlowChartExecutor(chart);
    await executor.run({ input });

    const state = executor.getSnapshot().sharedState as Partial<LoanState>;
    expect(state.creditTier).toBe('excellent');
    expect(state.dtiStatus).toBe('healthy');
    expect(state.employmentVerified).toBe(true);
    expect(state.riskTier).toBe('low');
    expect(state.decision).toContain('APPROVED');
  });
});
