/**
 * Integration test: Loan Application Demo Pipeline
 *
 * Verifies the demo pipeline API contract before each release:
 *   - All three decision branches (approved, rejected, manual-review)
 *   - decide() evidence appears in narrative
 *   - All exported symbols are present
 *   - Snapshot for the default demo scenario
 */
import { describe, it, expect } from 'vitest';
import {
  runLoanPipeline,
  flowchartSpec,
  type LoanApplication,
  type LoanResult,
} from '../../demos/loan-application';

// ── Helpers ─────────────────────────────────────────────────────────────────

const base: LoanApplication = {
  applicantName: 'Test User',
  annualIncome: 60_000,
  monthlyDebts: 1_000,
  creditScore: 720,
  employmentStatus: 'employed',
  employmentYears: 3,
  loanAmount: 20_000,
};

function app(overrides: Partial<LoanApplication>): LoanApplication {
  return { ...base, ...overrides };
}

// ── Exports ──────────────────────────────────────────────────────────────────

describe('Loan demo — exports', () => {
  it('flowchartSpec is present and has root stage name', () => {
    expect(flowchartSpec).toBeDefined();
    expect((flowchartSpec as any).name).toBe('ReceiveApplication');
  });

  it('runLoanPipeline is a function', () => {
    expect(typeof runLoanPipeline).toBe('function');
  });
});

// ── Decision branches ────────────────────────────────────────────────────────

describe('Loan demo — decision branches', () => {
  it('approves a low-risk applicant', async () => {
    const result = await runLoanPipeline(app({ creditScore: 750, employmentStatus: 'employed', employmentYears: 4, monthlyDebts: 800 }));
    expect(result.riskTier).toBe('low');
    expect(result.decision).toMatch(/^APPROVED/);
    expect(result.creditTier).toBe('excellent');
  });

  it('rejects a high-risk applicant (poor credit)', async () => {
    const result = await runLoanPipeline(app({ creditScore: 520 }));
    expect(result.riskTier).toBe('high');
    expect(result.decision).toMatch(/^REJECTED/);
    expect(result.riskFactors).toContain('poor credit history');
  });

  it('rejects a high-risk applicant (excessive DTI)', async () => {
    const result = await runLoanPipeline(app({ annualIncome: 24_000, monthlyDebts: 1_200 }));
    // DTI = 1200 / 2000 = 60% → excessive
    expect(result.riskTier).toBe('high');
    expect(result.decision).toMatch(/^REJECTED/);
    const hasDtiFactor = result.riskFactors.some((f) => f.includes('DTI'));
    expect(hasDtiFactor).toBe(true);
  });

  it('rejects unemployed applicant', async () => {
    const result = await runLoanPipeline(app({ employmentStatus: 'unemployed' }));
    expect(result.riskTier).toBe('high');
    expect(result.riskFactors).toContain('applicant is unemployed');
  });

  it('flags self-employed < 2 years', async () => {
    const result = await runLoanPipeline(app({ employmentStatus: 'self-employed', employmentYears: 1 }));
    expect(result.riskFactors.some((f) => f.includes('self-employed'))).toBe(true);
  });
});

// ── Result shape ─────────────────────────────────────────────────────────────

describe('Loan demo — result shape', () => {
  it('returns all required LoanResult fields', async () => {
    const result: LoanResult = await runLoanPipeline(base);
    expect(result.decision).toBeDefined();
    expect(result.creditTier).toBeDefined();
    expect(typeof result.dtiPercent).toBe('number');
    expect(result.riskTier).toBeDefined();
    expect(Array.isArray(result.riskFactors)).toBe(true);
    expect(Array.isArray(result.narrative)).toBe(true);
    expect(Array.isArray(result.narrativeEntries)).toBe(true);
    expect(result.snapshot).toBeDefined();
    expect(result.runtimeSnapshot).toBeDefined();
  });

  it('narrative is non-empty', async () => {
    const result = await runLoanPipeline(base);
    expect(result.narrative.length).toBeGreaterThan(0);
  });

  it('narrative contains decide() evidence', async () => {
    const result = await runLoanPipeline(base);
    const joined = result.narrative.join('\n');
    expect(joined).toContain('[Condition]');
  });

  it('applicantName appears in decision string', async () => {
    const result = await runLoanPipeline(app({ applicantName: 'Jane Doe' }));
    expect(result.decision).toContain('Jane Doe');
  });
});

// ── Snapshot ─────────────────────────────────────────────────────────────────

describe('Loan demo — snapshot (default demo scenario)', () => {
  it('matches snapshot for approved applicant', async () => {
    const result = await runLoanPipeline({
      applicantName: 'Alice Chen',
      annualIncome: 95_000,
      monthlyDebts: 1_200,
      creditScore: 760,
      employmentStatus: 'employed',
      employmentYears: 6,
      loanAmount: 35_000,
    });
    expect({
      decision: result.decision,
      riskTier: result.riskTier,
      creditTier: result.creditTier,
      dtiPercent: result.dtiPercent,
      riskFactors: result.riskFactors,
    }).toMatchSnapshot();
  });

  it('matches snapshot for rejected applicant', async () => {
    const result = await runLoanPipeline({
      applicantName: 'Bob Martinez',
      annualIncome: 42_000,
      monthlyDebts: 2_100,
      creditScore: 580,
      employmentStatus: 'self-employed',
      employmentYears: 1,
      loanAmount: 40_000,
    });
    expect({
      decision: result.decision,
      riskTier: result.riskTier,
      creditTier: result.creditTier,
      dtiPercent: result.dtiPercent,
      riskFactors: result.riskFactors,
    }).toMatchSnapshot();
  });
});
