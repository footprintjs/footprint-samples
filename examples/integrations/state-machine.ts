/**
 * Integration: State Machine + FootPrint
 *
 * Shows how FootPrint complements an existing state machine.
 * Each state handler internally runs a FootPrint flowchart,
 * giving you full causal traces without changing your FSM design.
 *
 * Scenario: Order fulfillment — states flow through
 *   RECEIVED → VALIDATED → PAYMENT_PROCESSED → SHIPPED → DELIVERED
 *
 * Run:  npm run integration:state-machine
 */

import {
  flowChart,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeRecorder,
  CombinedNarrativeBuilder,
} from 'footprint';

// ── Domain types ──────────────────────────────────────────────────────

interface Order {
  id: string;
  customer: string;
  items: { name: string; qty: number; price: number }[];
  shippingAddress: string;
}

type OrderState =
  | 'RECEIVED'
  | 'VALIDATED'
  | 'PAYMENT_PROCESSED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'FAILED';

// ── Simple FSM engine ─────────────────────────────────────────────────

type StateHandler = (order: Order, context: Record<string, any>) => Promise<OrderState>;

class OrderStateMachine {
  private handlers = new Map<OrderState, StateHandler>();

  on(state: OrderState, handler: StateHandler) {
    this.handlers.set(state, handler);
    return this;
  }

  async run(order: Order): Promise<{ finalState: OrderState; context: Record<string, any> }> {
    let currentState: OrderState = 'RECEIVED';
    const context: Record<string, any> = {};

    while (this.handlers.has(currentState)) {
      const handler = this.handlers.get(currentState)!;
      console.log(`  [FSM] State: ${currentState}`);
      currentState = await handler(order, context);
    }

    console.log(`  [FSM] Final: ${currentState}`);
    return { finalState: currentState, context };
  }
}

// ── Shared NarrativeRecorder captures traces across ALL flowcharts ────

const recorder = new NarrativeRecorder({ id: 'order', detail: 'full' });
const scopeFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(recorder);
  return scope;
};

// ── Wire up the FSM with FootPrint-powered handlers ──────────────────
// Each state handler builds and runs a small FootPrint flowchart.
// The FSM controls transitions; FootPrint captures the "why" inside each state.

const fsm = new OrderStateMachine()
  .on('RECEIVED', async (order, context) => {
    // Validation flowchart: check inventory → check address
    let allInStock = false;
    let addressValid = false;

    const chart = flowChart('CheckInventory', async (scope: ScopeFacade) => {
      scope.setValue('items', order.items);
      allInStock = order.items.every((item) => item.qty <= 100);
      scope.setValue('allInStock', allInStock);
    })
      .addFunction('CheckAddress', async (scope: ScopeFacade) => {
        scope.setValue('shippingAddress', order.shippingAddress);
        addressValid = order.shippingAddress.length > 5;
        scope.setValue('addressValid', addressValid);
      })
      .build();

    await new FlowChartExecutor(chart, scopeFactory).run();
    context.validation = { allInStock, addressValid };
    return allInStock && addressValid ? 'VALIDATED' : 'FAILED';
  })
  .on('VALIDATED', async (order, context) => {
    // Payment flowchart: calculate total → charge
    let total = 0;
    let paymentId = '';

    const chart = flowChart('CalculateTotal', async (scope: ScopeFacade) => {
      total = order.items.reduce((sum, i) => sum + i.price * i.qty, 0);
      scope.setValue('total', total);
    })
      .addFunction('ChargePayment', async (scope: ScopeFacade) => {
        await new Promise((r) => setTimeout(r, 30)); // simulate payment gateway
        paymentId = `PAY-${Date.now()}`;
        scope.setValue('paymentId', paymentId);
        scope.setValue('charged', total);
      })
      .build();

    await new FlowChartExecutor(chart, scopeFactory).run();
    context.payment = { total, paymentId };
    return 'PAYMENT_PROCESSED';
  })
  .on('PAYMENT_PROCESSED', async (order, context) => {
    // Shipping flowchart: create label → dispatch carrier
    let trackingNumber = '';
    let carrier = '';

    const chart = flowChart('CreateLabel', async (scope: ScopeFacade) => {
      await new Promise((r) => setTimeout(r, 20)); // simulate label creation
      trackingNumber = `TRK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      scope.setValue('trackingNumber', trackingNumber);
      scope.setValue('labelAddress', order.shippingAddress);
    })
      .addFunction('DispatchCarrier', async (scope: ScopeFacade) => {
        carrier = 'FastShip';
        scope.setValue('carrier', carrier);
        scope.setValue('estimatedDays', 3);
        scope.setValue('dispatchStatus', `Dispatched ${trackingNumber} via ${carrier}`);
      })
      .build();

    await new FlowChartExecutor(chart, scopeFactory).run();
    context.shipping = { trackingNumber, carrier };
    return 'SHIPPED';
  })
  .on('SHIPPED', async (_order, context) => {
    // In real life this would be triggered by a webhook
    context.deliveredAt = new Date().toISOString();
    return 'DELIVERED';
  });

// ── Run it ───────────────────────────────────────────────────────────

(async () => {
  const order: Order = {
    id: 'ORD-42',
    customer: 'Alice Chen',
    items: [
      { name: 'Mechanical Keyboard', qty: 1, price: 149.99 },
      { name: 'USB-C Cable', qty: 2, price: 12.99 },
    ],
    shippingAddress: '123 Main St, Portland, OR 97201',
  };

  console.log('=== Order Fulfillment: State Machine + FootPrint ===\n');
  const { finalState, context } = await fsm.run(order);

  console.log('\n--- Result ---');
  console.log('Final state:', finalState);
  console.log('Payment:', context.payment);
  console.log('Shipping:', context.shipping);

  // Print the combined causal trace across ALL flowcharts
  console.log('\n--- Causal Trace (from FootPrint) ---\n');
  const combined = new CombinedNarrativeBuilder();
  const narrative = combined.build([], recorder);
  narrative.forEach((line) => console.log(`  ${line}`));

  console.log('\nThe FSM handled transitions. FootPrint captured the reasoning.');
  console.log('Feed the trace to an LLM to answer: "Why was this order shipped?"');
})().catch(console.error);
