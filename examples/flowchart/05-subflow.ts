/**
 * Flowchart: Subflow (Nested Pipeline)
 *
 * A subflow is a complete flowchart mounted inside another.
 * The parent pipeline runs the subflow as a single stage,
 * then continues after it completes.
 *
 *   Parent:  CreateOrder → [PaymentSubflow] → ShipOrder
 *   Subflow: ValidateCard → ChargeCard → SendReceipt
 * Try it: https://footprintjs.github.io/footprint-playground/samples/subflow
 */

import { flowChart, FlowChartBuilder, FlowChartExecutor, ScopeFacade } from 'footprint';

(async () => {

// ── Mock Services ───────────────────────────────────────────────────────

const paymentGateway = {
  validateCard: (last4: string) => ({
    valid: last4.length === 4,
    network: 'Visa',
    expiresAt: '2027-08',
  }),
  charge: (amount: number) => ({
    success: amount < 50_000,
    transactionId: 'TXN-' + Date.now(),
    settledAt: new Date().toISOString(),
  }),
};

const shippingService = {
  createLabel: (orderId: string) => ({
    trackingNumber: 'TRK-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    carrier: 'FedEx',
    estimatedDelivery: '3–5 business days',
  }),
};

// ── Subflow Stage Functions ─────────────────────────────────────────────

const validateCard = async (scope: ScopeFacade) => {
  const last4 = scope.getValue('cardLast4') as string;
  const result = paymentGateway.validateCard(last4);
  scope.setValue('cardValid', result.valid);
  scope.setValue('cardNetwork', result.network);
};

const chargeCard = async (scope: ScopeFacade) => {
  const amount = scope.getValue('orderTotal') as number;
  const valid = scope.getValue('cardValid') as boolean;
  if (!valid) {
    scope.setValue('paymentStatus', 'failed');
    return;
  }
  await new Promise((r) => setTimeout(r, 40)); // simulate gateway latency
  const result = paymentGateway.charge(amount);
  scope.setValue('paymentStatus', result.success ? 'charged' : 'declined');
  scope.setValue('transactionId', result.transactionId);
};

const sendReceipt = async (scope: ScopeFacade) => {
  const status = scope.getValue('paymentStatus') as string;
  const txnId = scope.getValue('transactionId') as string;
  scope.setValue('receiptSent', status === 'charged');
  if (status === 'charged') {
    console.log(`  Receipt sent for transaction ${txnId}`);
  }
};

// ── Parent Stage Functions ──────────────────────────────────────────────

const createOrder = async (scope: ScopeFacade) => {
  scope.setValue('orderId', 'ORD-42');
  scope.setValue('orderTotal', 129.99);
  scope.setValue('customerName', 'Eve');
  scope.setValue('cardLast4', '4242');
};

const shipOrder = async (scope: ScopeFacade) => {
  const status = scope.getValue('paymentStatus') as string;
  const orderId = scope.getValue('orderId') as string;
  if (status === 'charged') {
    const label = shippingService.createLabel(orderId);
    scope.setValue('tracking', label.trackingNumber);
    scope.setValue('carrier', label.carrier);
    scope.setValue('shipmentStatus', 'shipped');
    console.log(`  ${orderId} shipped via ${label.carrier} — ${label.trackingNumber}`);
  } else {
    scope.setValue('shipmentStatus', 'on-hold');
    console.log(`  ${orderId} on hold — payment ${status}`);
  }
};

// ── Build the Subflow ───────────────────────────────────────────────────

const paymentSubflow = flowChart('ValidateCard', validateCard, 'validate-card')
  .addFunction('ChargeCard', chargeCard, 'charge-card')
  .addFunction('SendReceipt', sendReceipt, 'send-receipt')
  .build();

// ── Build the Parent Flowchart ──────────────────────────────────────────

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('CreateOrder', createOrder, 'create-order')
  .addSubFlowChartNext('payment', paymentSubflow, 'ProcessPayment', {
    inputMapper: (parentScope: any) => ({
      orderTotal: parentScope.orderTotal,
      cardLast4: parentScope.cardLast4,
    }),
  })
  .addFunction('ShipOrder', shipOrder, 'ship-order')
  .build();

// ── Run ─────────────────────────────────────────────────────────────────

const executor = new FlowChartExecutor(chart);
await executor.run();

console.log('\n=== Subflow (Nested Pipeline) ===\n');
executor.getNarrative().forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
