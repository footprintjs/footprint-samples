/**
 * Flowchart: Subflow (Nested Pipeline)
 *
 * A subflow is a complete flowchart mounted inside another.
 * The parent pipeline runs the subflow as a single stage,
 * then continues after it completes.
 *
 *   Parent:  LoadOrder → [PaymentSubflow] → ShipOrder
 *   Subflow: Validate → Charge → Confirm
 *
 * Run:  npm run flow:subflow
 */

import {
  flowChart,
  FlowChartBuilder,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeRecorder,
  CombinedNarrativeBuilder,
} from 'footprint';

(async () => {

const recorder = new NarrativeRecorder({ id: 'subflow', detail: 'full' });

// ── Build the subflow (a standalone flowchart) ──────────────────────────

const paymentSubflow = flowChart('ValidatePayment', async (scope: ScopeFacade) => {
  const amount = scope.getValue('orderTotal') as number;
  scope.setValue('paymentValid', amount > 0 && amount < 50_000);
})
  .addFunction('ChargeCard', async (scope: ScopeFacade) => {
    const valid = scope.getValue('paymentValid') as boolean;
    scope.setValue('charged', valid);
    scope.setValue('transactionId', valid ? 'TXN-' + Date.now() : null);
  })
  .addFunction('ConfirmPayment', async (scope: ScopeFacade) => {
    const charged = scope.getValue('charged') as boolean;
    scope.setValue('paymentStatus', charged ? 'confirmed' : 'failed');
  })
  .build();

// ── Build the parent flow ───────────────────────────────────────────────

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('LoadOrder', async (scope: ScopeFacade) => {
    scope.setValue('orderId', 'ORD-42');
    scope.setValue('orderTotal', 129.99);
    scope.setValue('customer', 'Eve');
  })
  .addSubFlowChartNext('payment', paymentSubflow, 'ProcessPayment', {
    inputMapper: (parentScope: any) => ({
      orderTotal: parentScope.orderTotal,
    }),
  })
  .addFunction('ShipOrder', async (scope: ScopeFacade) => {
    const status = scope.getValue('paymentStatus') as string;
    const orderId = scope.getValue('orderId') as string;
    scope.setValue(
      'shipment',
      status === 'confirmed' ? `${orderId} shipped` : `${orderId} on hold`,
    );
  })
  .build();

const scopeFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(recorder);
  return scope;
};

const executor = new FlowChartExecutor(chart, scopeFactory);
await executor.run();

const narrative = new CombinedNarrativeBuilder().build(
  executor.getFlowNarrative(),
  recorder,
);

console.log('=== Subflow (Nested Pipeline) ===\n');
narrative.forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
