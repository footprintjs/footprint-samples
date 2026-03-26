/**
 * Integration test: Subflow PII Boundary (features/17-subflow-redaction)
 *
 * Verifies that redaction carries across the subflow→parent outputMapper boundary:
 *   - Raw card number never appears in the parent narrative
 *   - [REDACTED] appears wherever cardNumber is accessed
 *   - Business logic results (charged, transactionId, status) propagate correctly
 *   - The snapshot matches golden output
 */
import { describe, it, expect } from 'vitest';
import { flowChart, FlowChartBuilder, FlowChartExecutor } from 'footprint';
import type { TypedScope } from 'footprint';

const RAW_CARD = '4111-1111-1111-1111';

// ── Types ──────────────────────────────────────────────────────────────────

interface PaymentSubflowState {
  cardNumber: string;
  charged: boolean;
  transactionId: string;
}

interface CheckoutState {
  orderId: string;
  total: number;
  cardLast4: string;
  cardNumber: string;
  charged: boolean;
  transactionId: string;
  status: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildPaymentSubflow() {
  return new FlowChartBuilder<any, TypedScope<PaymentSubflowState>>()
    .start(
      'CaptureCard',
      async (scope) => {
        const { rawCard } = scope.$getArgs<{ rawCard: string }>();
        scope.$setValue('cardNumber', rawCard, true); // per-call redaction — no policy needed
      },
      'capture-card',
      'Capture and redact the full card number',
    )
    .addFunction(
      'ChargeCard',
      async (scope) => {
        const valid = scope.cardNumber.startsWith('4');
        scope.charged = valid;
        // Deterministic transactionId — safe to snapshot
        scope.transactionId = valid ? 'TXN-SNAPSHOT-SAFE' : 'TXN-DECLINED';
      },
      'charge-card',
      'Charge the customer card',
    )
    .build();
}

function buildCheckoutChart() {
  return flowChart<CheckoutState>(
    'CreateOrder',
    async (scope) => {
      scope.orderId = 'ORD-100';
      scope.total = 149.99;
      scope.cardLast4 = '1111';
      scope.status = 'pending';
    },
    'create-order',
    'Initialize the checkout order',
  )
    .addSubFlowChartNext('payment', buildPaymentSubflow(), 'ProcessPayment', {
      inputMapper: (_parentScope: any) => ({ rawCard: RAW_CARD }),
      outputMapper: (subflowOutput: any) => ({
        // No shouldRedact flag here — fix ensures this write is still redacted
        cardNumber: subflowOutput.cardNumber,
        charged: subflowOutput.charged,
        transactionId: subflowOutput.transactionId,
      }),
    })
    .addFunction(
      'ConfirmOrder',
      async (scope) => {
        scope.status = scope.charged ? 'confirmed' : 'payment-failed';
      },
      'confirm-order',
      'Finalize order status',
    )
    .build();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Subflow PII Boundary — features/17-subflow-redaction', () => {
  it('narrative matches snapshot', async () => {
    const executor = new FlowChartExecutor(buildCheckoutChart());
    executor.enableNarrative();
    await executor.run();

    expect(executor.getNarrative()).toMatchSnapshot();
  });

  it('raw card number never appears in narrative (PII boundary)', async () => {
    const executor = new FlowChartExecutor(buildCheckoutChart());
    executor.enableNarrative();
    await executor.run();

    const narrative = executor.getNarrative().join('\n');
    expect(narrative).not.toContain(RAW_CARD);
    // [REDACTED] must appear — confirms redaction is active, not just silent
    expect(narrative).toContain('[REDACTED]');
  });

  it('business logic results propagate correctly via outputMapper', async () => {
    const executor = new FlowChartExecutor(buildCheckoutChart());
    executor.enableNarrative();
    await executor.run();

    const state = executor.getSnapshot().sharedState as CheckoutState;
    expect(state.charged).toBe(true);
    expect(state.transactionId).toBe('TXN-SNAPSHOT-SAFE');
    expect(state.status).toBe('confirmed');
    expect(state.orderId).toBe('ORD-100');
  });

  it('redaction report lists cardNumber', async () => {
    const executor = new FlowChartExecutor(buildCheckoutChart());
    executor.enableNarrative();
    await executor.run();

    const report = executor.getRedactionReport();
    expect(report.redactedKeys).toContain('cardNumber');
  });
});
