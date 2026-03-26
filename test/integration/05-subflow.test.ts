/**
 * Integration test: Subflow (Nested Pipeline) — flowchart/05-subflow
 *
 * Verifies that a parent+subflow pipeline produces the expected narrative,
 * including subflow entry/exit markers. Uses deterministic mock services
 * (no Date.now() or Math.random()) so snapshots are stable.
 */
import { describe, it, expect } from 'vitest';
import { flowChart, FlowChartBuilder, FlowChartExecutor, type TypedScope } from 'footprint';

// ── State types ────────────────────────────────────────────────────────────

interface SubflowPaymentState {
  orderTotal: number;
  cardLast4: string;
  cardValid: boolean;
  cardNetwork: string;
  paymentStatus: string;
  transactionId?: string;
  receiptSent: boolean;
}

interface ParentOrderState {
  orderId: string;
  orderTotal: number;
  customerName: string;
  cardLast4: string;
  cardValid?: boolean;
  cardNetwork?: string;
  paymentStatus?: string;
  transactionId?: string;
  receiptSent?: boolean;
  tracking?: string;
  carrier?: string;
  shipmentStatus: string;
}

// ── Deterministic mock services ────────────────────────────────────────────

const paymentGateway = {
  validateCard: (_last4: string) => ({
    valid: true,
    network: 'Visa',
  }),
  charge: (_amount: number) => ({
    success: true,
    transactionId: 'TXN-TEST-001',   // fixed, not Date.now()
  }),
};

const shippingService = {
  createLabel: (_orderId: string) => ({
    trackingNumber: 'TRK-TEST-001',  // fixed, not Math.random()
    carrier: 'FedEx',
  }),
};

// ── Chart builders ─────────────────────────────────────────────────────────

function buildPaymentSubflow() {
  return new FlowChartBuilder<any, TypedScope<SubflowPaymentState>>()
    .start('ValidateCard', async (scope) => {
      const result = paymentGateway.validateCard(scope.cardLast4);
      scope.cardValid = result.valid;
      scope.cardNetwork = result.network;
    }, 'validate-card', 'Verify card details')
    .addFunction('ChargeCard', async (scope) => {
      if (!scope.cardValid) {
        scope.paymentStatus = 'failed';
        return;
      }
      const result = paymentGateway.charge(scope.orderTotal);
      scope.paymentStatus = result.success ? 'charged' : 'declined';
      scope.transactionId = result.transactionId;
    }, 'charge-card', 'Charge the customer card')
    .addFunction('SendReceipt', async (scope) => {
      scope.receiptSent = scope.paymentStatus === 'charged';
    }, 'send-receipt', 'Send transaction receipt')
    .build();
}

function buildParentChart(paymentSubflow: ReturnType<typeof buildPaymentSubflow>) {
  return flowChart<ParentOrderState>('CreateOrder', async (scope) => {
    scope.orderId = 'ORD-42';
    scope.orderTotal = 129.99;
    scope.customerName = 'Eve';
    scope.cardLast4 = '4242';
  }, 'create-order')
    .addSubFlowChartNext('payment', paymentSubflow, 'ProcessPayment', {
      inputMapper: (parentScope: any) => ({
        orderTotal: parentScope.orderTotal,
        cardLast4: parentScope.cardLast4,
      }),
      outputMapper: (subflowOutput: any) => ({
        cardValid: subflowOutput.cardValid,
        cardNetwork: subflowOutput.cardNetwork,
        paymentStatus: subflowOutput.paymentStatus,
        transactionId: subflowOutput.transactionId,
        receiptSent: subflowOutput.receiptSent,
      }),
    })
    .addFunction('ShipOrder', async (scope) => {
      if (scope.paymentStatus === 'charged') {
        const label = shippingService.createLabel(scope.orderId);
        scope.tracking = label.trackingNumber;
        scope.carrier = label.carrier;
        scope.shipmentStatus = 'shipped';
      } else {
        scope.shipmentStatus = 'on-hold';
      }
    }, 'ship-order', 'Create shipping label')
    .build();
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Subflow Pipeline — flowchart/05-subflow', () => {

  it('successful payment path — narrative matches snapshot', async () => {
    const subflow = buildPaymentSubflow();
    const chart = buildParentChart(subflow);
    const executor = new FlowChartExecutor(chart);
    executor.enableNarrative();
    await executor.run();

    const narrative = executor.getNarrative();
    expect(narrative).toMatchSnapshot();
    // Subflow entry/exit markers appear in narrative
    expect(narrative.some(l => l.includes('ProcessPayment') && l.includes('subflow'))).toBe(true);
    // Subflow stages appear inside the narrative
    expect(narrative.some(l => l.includes('Charge the customer card') || l.includes('paymentStatus'))).toBe(true);
    // Parent ShipOrder stage executed after subflow
    expect(narrative.some(l => l.includes('Create shipping label') || l.includes('shipmentStatus'))).toBe(true);
  });

  it('final state has correct shape after parent+subflow pipeline', async () => {
    const subflow = buildPaymentSubflow();
    const chart = buildParentChart(subflow);
    const executor = new FlowChartExecutor(chart);
    await executor.run();

    const state = executor.getSnapshot().sharedState as Partial<ParentOrderState>;
    expect(state.cardValid).toBe(true);
    expect(state.paymentStatus).toBe('charged');
    expect(state.transactionId).toBe('TXN-TEST-001');
    expect(state.receiptSent).toBe(true);
    expect(state.shipmentStatus).toBe('shipped');
    expect(state.carrier).toBe('FedEx');
    expect(state.tracking).toBe('TRK-TEST-001');
  });

  it('failed payment skips shipping', async () => {
    const failingGateway = {
      validateCard: (_last4: string) => ({ valid: false, network: 'Unknown' }),
      charge: (_amount: number) => ({ success: false, transactionId: '' }),
    };
    const failingShipping = { createLabel: () => ({ trackingNumber: '', carrier: '' }) };

    const subflow = new FlowChartBuilder<any, TypedScope<SubflowPaymentState>>()
      .start('ValidateCard', async (scope) => {
        const result = failingGateway.validateCard(scope.cardLast4);
        scope.cardValid = result.valid;
        scope.cardNetwork = result.network;
      }, 'validate-card')
      .addFunction('ChargeCard', async (scope) => {
        if (!scope.cardValid) {
          scope.paymentStatus = 'failed';
          return;
        }
        scope.paymentStatus = 'charged';
      }, 'charge-card')
      .addFunction('SendReceipt', async (scope) => {
        scope.receiptSent = scope.paymentStatus === 'charged';
      }, 'send-receipt')
      .build();

    const chart = flowChart<ParentOrderState>('CreateOrder', async (scope) => {
      scope.orderId = 'ORD-99';
      scope.orderTotal = 50.00;
      scope.customerName = 'Frank';
      scope.cardLast4 = '0000';
    }, 'create-order')
      .addSubFlowChartNext('payment', subflow, 'ProcessPayment', {
        inputMapper: (parentScope: any) => ({
          orderTotal: parentScope.orderTotal,
          cardLast4: parentScope.cardLast4,
        }),
        outputMapper: (subflowOutput: any) => ({
          cardValid: subflowOutput.cardValid,
          cardNetwork: subflowOutput.cardNetwork,
          paymentStatus: subflowOutput.paymentStatus,
          transactionId: subflowOutput.transactionId,
          receiptSent: subflowOutput.receiptSent,
        }),
      })
      .addFunction('ShipOrder', async (scope) => {
        if (scope.paymentStatus === 'charged') {
          const label = failingShipping.createLabel();
          scope.tracking = label.trackingNumber;
          scope.carrier = label.carrier;
          scope.shipmentStatus = 'shipped';
        } else {
          scope.shipmentStatus = 'on-hold';
        }
      }, 'ship-order')
      .build();

    const executor = new FlowChartExecutor(chart);
    await executor.run();

    const state = executor.getSnapshot().sharedState as Partial<ParentOrderState>;
    expect(state.cardValid).toBe(false);
    expect(state.paymentStatus).toBe('failed');
    expect(state.shipmentStatus).toBe('on-hold');
    expect(state.receiptSent).toBe(false);
  });
});
