/**
 * Flowchart: Fork (Parallel Branches)
 *
 * Fork runs multiple branches in parallel, then continues
 * after all branches complete.
 *
 *                ┌─ CheckInventory ─┐
 *   LoadOrder ───┤                  ├── FinalizeOrder
 *                └─ RunFraudCheck ──┘
 * Try it: https://footprintjs.github.io/footprint-playground/samples/fork
 */

import { FlowChartBuilder, FlowChartExecutor, ScopeFacade } from 'footprint';

(async () => {

// ── Mock Services ───────────────────────────────────────────────────────

const orderDB = new Map([
  ['ORD-001', { customerId: 'C-42', items: ['Widget A', 'Gadget B'], amount: 250 }],
  ['ORD-002', { customerId: 'C-99', items: ['Premium X'], amount: 5_200 }],
]);

const inventoryService = {
  check: (items: string[]) => ({
    inStock: true,
    warehouse: 'WH-East',
    estimatedShip: '2–3 business days',
  }),
};

const fraudService = {
  evaluate: (amount: number, customerId: string) => ({
    score: amount > 1000 ? 0.72 : 0.05,
    cleared: amount <= 1000,
    flags: amount > 1000 ? ['high-value transaction'] : [],
  }),
};

// ── Stage Functions ─────────────────────────────────────────────────────

const loadOrder = async (scope: ScopeFacade) => {
  const order = orderDB.get('ORD-001')!;
  scope.setValue('order', order);
  scope.setValue('orderId', 'ORD-001');
};

const checkInventory = async (scope: ScopeFacade) => {
  const order = scope.getValue('order') as any;
  await new Promise((r) => setTimeout(r, 30)); // simulate warehouse API
  const result = inventoryService.check(order.items);
  scope.setValue('inStock', result.inStock);
  scope.setValue('warehouse', result.warehouse);
  scope.setValue('estimatedShip', result.estimatedShip);
};

const runFraudCheck = async (scope: ScopeFacade) => {
  const order = scope.getValue('order') as any;
  await new Promise((r) => setTimeout(r, 20)); // simulate fraud API
  const result = fraudService.evaluate(order.amount, order.customerId);
  scope.setValue('fraudScore', result.score);
  scope.setValue('fraudCleared', result.cleared);
  scope.setValue('fraudFlags', result.flags);
};

const finalizeOrder = async (scope: ScopeFacade) => {
  const inStock = scope.getValue('inStock') as boolean;
  const cleared = scope.getValue('fraudCleared') as boolean;
  const orderId = scope.getValue('orderId') as string;
  const status = inStock && cleared ? 'confirmed' : 'held-for-review';
  scope.setValue('orderStatus', status);
  console.log(`  Order ${orderId}: ${status}`);
};

// ── Flowchart ───────────────────────────────────────────────────────────

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('LoadOrder', loadOrder, 'load-order')
  .addListOfFunction([
    { id: 'CheckInventory', name: 'CheckInventory', fn: checkInventory },
    { id: 'RunFraudCheck', name: 'RunFraudCheck', fn: runFraudCheck },
  ])
  .addFunction('FinalizeOrder', finalizeOrder, 'finalize-order')
  .build();

// ── Run ─────────────────────────────────────────────────────────────────

const executor = new FlowChartExecutor(chart);
await executor.run();

console.log('=== Fork (Parallel Branches) ===\n');
executor.getNarrative().forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
