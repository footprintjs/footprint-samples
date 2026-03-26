/**
 * Integration test: Decider with decide() (flowchart/03-decider)
 *
 * Verifies that a decider pipeline with decide() function-style rules produces
 * the expected evidence-aware narrative. Uses fixed system time for year calculation.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { flowChart, FlowChartExecutor, decide } from 'footprint';

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

interface Customer {
  name: string;
  plan: string;
  totalSpend: number;
  since: string;
}

interface DeciderState {
  customer: Customer;
  cartAmount: number;
  discountPct: number;
  message: string;
  finalAmount: number;
}

const customerDB = new Map([
  ['C-42', { name: 'Charlie', plan: 'premium', totalSpend: 4_200, since: '2022-03-01' }],
  ['C-77', { name: 'Dana', plan: 'standard', totalSpend: 320, since: '2024-11-15' }],
  ['C-99', { name: 'Eve', plan: 'trial', totalSpend: 0, since: '2025-02-28' }],
]);

function buildChart() {
  return flowChart<DeciderState>('LoadCustomer', async (scope) => {
    scope.customer = customerDB.get('C-42')!;
    scope.cartAmount = 150;
  }, 'load-customer')
    .addDeciderFunction('ClassifyTier', (scope) => {
      return decide(scope, [
        {
          when: (s) => s.customer.plan === 'premium' && s.customer.totalSpend > 1000,
          then: 'premium',
          label: 'Premium with high spend',
        },
        {
          when: (s) => s.customer.plan === 'standard',
          then: 'standard',
          label: 'Standard plan',
        },
      ], 'trial');
    }, 'classify-tier', 'Classify customer tier')
    .addFunctionBranch('premium', 'ApplyLoyaltyDiscount', async (scope) => {
      const years = new Date().getFullYear() - new Date(scope.customer.since).getFullYear();
      scope.discountPct = Math.min(years * 5, 25);
      scope.message = `Thank you for ${years} years! ${scope.discountPct}% loyalty discount.`;
    }, 'Apply loyalty discount')
    .addFunctionBranch('standard', 'SuggestUpgrade', async (scope) => {
      scope.discountPct = 5;
      scope.message = 'Upgrade to Premium for up to 25% off every order.';
    }, 'Offer 5% and suggest upgrade')
    .addFunctionBranch('trial', 'ShowOnboarding', async (scope) => {
      scope.discountPct = 10;
      scope.message = 'Welcome! Enjoy 10% off your first order.';
    }, 'Welcome onboarding with 10% off')
    .setDefault('trial')
    .end()
    .addFunction('CalculateTotal', async (scope) => {
      scope.finalAmount = Math.round(scope.cartAmount * (1 - scope.discountPct / 100) * 100) / 100;
    }, 'calculate-total', 'Calculate final amount after discount')
    .build();
}

describe('Decider with decide() — flowchart/03-decider', () => {
  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  it('premium customer takes premium branch — narrative matches snapshot', async () => {
    vi.setSystemTime(FIXED_DATE);
    const chart = buildChart();
    const executor = new FlowChartExecutor(chart);
    executor.enableNarrative();
    await executor.run();

    const narrative = executor.getNarrative();
    expect(narrative).toMatchSnapshot();
    // Key behavioural assertions
    expect(narrative.some(l => l.includes('ApplyLoyaltyDiscount'))).toBe(true);
    expect(narrative.some(l => l.includes('Premium with high spend'))).toBe(true);
  });

  it('standard customer takes standard branch', async () => {
    vi.setSystemTime(FIXED_DATE);

    const chart = flowChart<DeciderState>('LoadCustomer', async (scope) => {
      scope.customer = customerDB.get('C-77')!;
      scope.cartAmount = 80;
    }, 'load-customer')
      .addDeciderFunction('ClassifyTier', (scope) => {
        return decide(scope, [
          {
            when: (s) => s.customer.plan === 'premium' && s.customer.totalSpend > 1000,
            then: 'premium',
            label: 'Premium with high spend',
          },
          {
            when: (s) => s.customer.plan === 'standard',
            then: 'standard',
            label: 'Standard plan',
          },
        ], 'trial');
      }, 'classify-tier')
      .addFunctionBranch('premium', 'ApplyLoyaltyDiscount', async (scope) => {
        scope.discountPct = 25;
        scope.message = 'Premium discount';
      })
      .addFunctionBranch('standard', 'SuggestUpgrade', async (scope) => {
        scope.discountPct = 5;
        scope.message = 'Upgrade to Premium for up to 25% off every order.';
      })
      .addFunctionBranch('trial', 'ShowOnboarding', async (scope) => {
        scope.discountPct = 10;
        scope.message = 'Trial';
      })
      .setDefault('trial')
      .end()
      .build();

    const executor = new FlowChartExecutor(chart);
    executor.enableNarrative();
    await executor.run();

    const narrative = executor.getNarrative();
    expect(narrative.some(l => l.includes('SuggestUpgrade'))).toBe(true);
    expect(narrative.some(l => l.includes('Standard plan'))).toBe(true);
  });

  it('trial customer falls through to default', async () => {
    vi.setSystemTime(FIXED_DATE);

    const chart = flowChart<DeciderState>('LoadCustomer', async (scope) => {
      scope.customer = customerDB.get('C-99')!;
      scope.cartAmount = 50;
    }, 'load-customer')
      .addDeciderFunction('ClassifyTier', (scope) => {
        return decide(scope, [
          {
            when: (s) => s.customer.plan === 'premium' && s.customer.totalSpend > 1000,
            then: 'premium',
            label: 'Premium with high spend',
          },
          {
            when: (s) => s.customer.plan === 'standard',
            then: 'standard',
            label: 'Standard plan',
          },
        ], 'trial');
      }, 'classify-tier')
      .addFunctionBranch('premium', 'ApplyLoyaltyDiscount', async (scope) => {
        scope.discountPct = 25;
        scope.message = 'Premium';
      })
      .addFunctionBranch('standard', 'SuggestUpgrade', async (scope) => {
        scope.discountPct = 5;
        scope.message = 'Standard';
      })
      .addFunctionBranch('trial', 'ShowOnboarding', async (scope) => {
        scope.discountPct = 10;
        scope.message = 'Welcome! Enjoy 10% off your first order.';
      })
      .setDefault('trial')
      .end()
      .build();

    const executor = new FlowChartExecutor(chart);
    executor.enableNarrative();
    await executor.run();

    const narrative = executor.getNarrative();
    expect(narrative.some(l => l.includes('ShowOnboarding'))).toBe(true);
  });
});
