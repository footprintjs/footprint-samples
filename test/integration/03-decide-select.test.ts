/**
 * Integration test: decide() / select() Evidence Capture (features/16-decide-select)
 *
 * Verifies that:
 * - decide() with filter rules captures operator+threshold evidence
 * - decide() with function rules captures which keys were read
 * - select() evaluates all rules and captures multi-match evidence
 */
import { describe, it, expect } from 'vitest';
import { flowChart, FlowChartExecutor, decide, select } from 'footprint';

// ── State types ────────────────────────────────────────────────────────────

interface LoanState {
  creditScore: number;
  dti: number;
  employmentStatus: string;
  decision?: string;
}

interface ScreeningState {
  glucose: number;
  systolicBP: number;
  bmi: number;
  results: string[];
}

describe('decide() / select() Evidence Capture — features/16-decide-select', () => {

  describe('decide() with filter rules', () => {
    it('approved path: narrative shows operator + threshold evidence', async () => {
      const chart = flowChart<LoanState>('LoadApplication', async (scope) => {
        scope.creditScore = 750;
        scope.dti = 0.38;
        scope.employmentStatus = 'employed';
      }, 'load-app')
        .addDeciderFunction('ClassifyRisk', (scope) => {
          return decide(scope, [
            {
              when: { creditScore: { gt: 700 }, dti: { lt: 0.43 } },
              then: 'approved',
              label: 'Good credit + low DTI',
            },
            {
              when: { creditScore: { gt: 600 } },
              then: 'manual-review',
              label: 'Marginal credit',
            },
          ], 'rejected');
        }, 'classify-risk', 'Evaluate loan risk')
        .addFunctionBranch('approved', 'Approve', async (scope) => {
          scope.decision = 'Approved - excellent profile';
        })
        .addFunctionBranch('manual-review', 'Review', async (scope) => {
          scope.decision = 'Sent to manual review';
        })
        .addFunctionBranch('rejected', 'Reject', async (scope) => {
          scope.decision = 'Rejected';
        })
        .setDefault('rejected')
        .end()
        .build();

      const executor = new FlowChartExecutor(chart);
      executor.enableNarrative();
      await executor.run();

      const narrative = executor.getNarrative();
      expect(narrative).toMatchSnapshot();
      // Filter evidence: operators and thresholds visible in narrative
      expect(narrative.some(l => l.includes('gt') && l.includes('700'))).toBe(true);
      expect(narrative.some(l => l.includes('lt') && l.includes('0.43'))).toBe(true);
      expect(narrative.some(l => l.includes('Good credit + low DTI'))).toBe(true);
      expect(narrative.some(l => l.includes('Approve'))).toBe(true);
    });

    it('rejected path: all rules fail, falls through to default', async () => {
      const chart = flowChart<LoanState>('LoadApplication', async (scope) => {
        scope.creditScore = 500;
        scope.dti = 0.55;
        scope.employmentStatus = 'unemployed';
      }, 'load-app')
        .addDeciderFunction('ClassifyRisk', (scope) => {
          return decide(scope, [
            { when: { creditScore: { gt: 700 }, dti: { lt: 0.43 } }, then: 'approved', label: 'Good credit' },
            { when: { creditScore: { gt: 600 } }, then: 'manual-review', label: 'Marginal' },
          ], 'rejected');
        }, 'classify-risk')
        .addFunctionBranch('approved', 'Approve', async (scope) => { scope.decision = 'Approved'; })
        .addFunctionBranch('manual-review', 'Review', async (scope) => { scope.decision = 'Review'; })
        .addFunctionBranch('rejected', 'Reject', async (scope) => { scope.decision = 'Rejected'; })
        .setDefault('rejected')
        .end()
        .build();

      const executor = new FlowChartExecutor(chart);
      executor.enableNarrative();
      await executor.run();

      const narrative = executor.getNarrative();
      expect(narrative.some(l => l.includes('Reject'))).toBe(true);
    });
  });

  describe('decide() with function rules', () => {
    it('manual-review path: function evidence shows which keys were read', async () => {
      const chart = flowChart<LoanState>('LoadApp', async (scope) => {
        scope.creditScore = 650;
        scope.dti = 0.50;
        scope.employmentStatus = 'self-employed';
      }, 'load-app-2')
        .addDeciderFunction('ClassifyRisk', (scope) => {
          return decide(scope, [
            {
              when: (s) => s.creditScore > 700 && s.dti < 0.43 && s.employmentStatus !== 'unemployed',
              then: 'approved',
              label: 'Full qualification',
            },
            {
              when: (s) => s.creditScore > 600,
              then: 'manual-review',
              label: 'Marginal - needs review',
            },
          ], 'rejected');
        }, 'classify-risk')
        .addFunctionBranch('approved', 'Approve', async (scope) => { scope.decision = 'Approved'; })
        .addFunctionBranch('manual-review', 'Review', async (scope) => { scope.decision = 'Manual review'; })
        .addFunctionBranch('rejected', 'Reject', async (scope) => { scope.decision = 'Rejected'; })
        .setDefault('rejected')
        .end()
        .build();

      const executor = new FlowChartExecutor(chart);
      executor.enableNarrative();
      await executor.run();

      const narrative = executor.getNarrative();
      expect(narrative).toMatchSnapshot();
      // Function evidence: key names captured but no operator/threshold
      expect(narrative.some(l => l.includes('Marginal - needs review'))).toBe(true);
      expect(narrative.some(l => l.includes('Review'))).toBe(true);
    });
  });

  describe('select() for multi-match', () => {
    it('selects diabetes + hypertension but not obesity', async () => {
      const chart = flowChart<ScreeningState>('LoadVitals', async (scope) => {
        scope.glucose = 128;
        scope.systolicBP = 148;
        scope.bmi = 25;
        scope.results = [];
      }, 'load-vitals')
        .addSelectorFunction('Triage', (scope) => {
          return select(scope, [
            { when: { glucose: { gt: 100 } }, then: 'diabetes', label: 'Elevated glucose' },
            { when: { systolicBP: { gt: 140 } }, then: 'hypertension', label: 'High BP' },
            { when: { bmi: { gt: 30 } }, then: 'obesity', label: 'High BMI' },
          ]);
        }, 'triage', 'Select screenings based on vitals')
        .addFunctionBranch('diabetes', 'DiabetesScreen', async (scope) => {
          scope.results = [...scope.results, 'Diabetes screening: glucose ' + scope.glucose];
        })
        .addFunctionBranch('hypertension', 'BPCheck', async (scope) => {
          scope.results = [...scope.results, 'BP check: systolic ' + scope.systolicBP];
        })
        .addFunctionBranch('obesity', 'BMIAssess', async (scope) => {
          scope.results = [...scope.results, 'BMI assessment: ' + scope.bmi];
        })
        .end()
        .addFunction('Report', async (scope) => {
          // Results collected
        }, 'report')
        .build();

      const executor = new FlowChartExecutor(chart);
      executor.enableNarrative();
      await executor.run();

      const narrative = executor.getNarrative();
      expect(narrative).toMatchSnapshot();
      // select() evidence: 2 of 3 matched
      expect(narrative.some(l => l.includes('diabetes') || l.includes('Elevated glucose'))).toBe(true);
      expect(narrative.some(l => l.includes('hypertension') || l.includes('High BP'))).toBe(true);
      // obesity should NOT be selected (bmi=25 is not > 30)
      expect(narrative.some(l => l.toLowerCase().includes('obesity') && l.includes('BMIAssess'))).toBe(false);
    });

    it('selects all three when all vitals are elevated — branches run as fork with own sub-scope', async () => {
      // Selector branches execute as parallel forks. Each branch writes to its own sub-scope
      // under state.runs.{branchId}. Use per-branch flag keys to verify execution.
      interface AllFlagsState {
        glucose: number;
        systolicBP: number;
        bmi: number;
        diabetesFlag?: boolean;
        hypertensionFlag?: boolean;
        obesityFlag?: boolean;
        results: string[];
      }

      const chart = flowChart<AllFlagsState>('LoadVitals', async (scope) => {
        scope.glucose = 130;
        scope.systolicBP = 145;
        scope.bmi = 35;
        scope.results = [];
      }, 'load-vitals')
        .addSelectorFunction('Triage', (scope) => {
          return select(scope, [
            { when: { glucose: { gt: 100 } }, then: 'diabetes', label: 'Elevated glucose' },
            { when: { systolicBP: { gt: 140 } }, then: 'hypertension', label: 'High BP' },
            { when: { bmi: { gt: 30 } }, then: 'obesity', label: 'High BMI' },
          ]);
        }, 'triage')
        .addFunctionBranch('diabetes', 'DiabetesScreen', async (scope) => {
          scope.diabetesFlag = true;
        })
        .addFunctionBranch('hypertension', 'BPCheck', async (scope) => {
          scope.hypertensionFlag = true;
        })
        .addFunctionBranch('obesity', 'BMIAssess', async (scope) => {
          scope.obesityFlag = true;
        })
        .end()
        .build();

      const executor = new FlowChartExecutor(chart);
      executor.enableNarrative();
      await executor.run();

      // Each branch's writes land in state.runs.{branchId}
      const snapshot = executor.getSnapshot();
      const runs = (snapshot.sharedState as any).runs;
      expect(runs?.diabetes?.diabetesFlag).toBe(true);
      expect(runs?.hypertension?.hypertensionFlag).toBe(true);
      expect(runs?.obesity?.obesityFlag).toBe(true);
    });
  });
});
