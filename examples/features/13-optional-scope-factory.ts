/**
 * Feature: Optional scopeFactory
 *
 * FlowChartExecutor now defaults to ScopeFacade when no scopeFactory
 * is provided. This eliminates boilerplate for the common case.
 *
 * This example shows three patterns:
 * 1. No scopeFactory — simplest (new in v0.6.0)
 * 2. Custom scopeFactory — with recorders
 * 3. Typed scopeFactory — with a ScopeFacade subclass
 *
 * Run:  npm run feature:scope-factory
 * Try it: https://footprintjs.github.io/footprint-playground/samples/optional-scope-factory
 */

import {
  flowChart,
  FlowChartExecutor,
  ScopeFacade,
  NarrativeRecorder,
} from 'footprint';

(async () => {

// ── Pattern 1: No scopeFactory (simplest) ───────────────────────────
// Just pass the chart. ScopeFacade is created automatically.

console.log('=== Pattern 1: No scopeFactory (default ScopeFacade) ===\n');

const chart1 = flowChart('Calculate', async (scope: ScopeFacade) => {
  scope.setValue('price', 49.99);
  scope.setValue('quantity', 3);
}, 'calculate')
  .addFunction('Total', async (scope: ScopeFacade) => {
    const price = scope.getValue('price') as number;
    const qty = scope.getValue('quantity') as number;
    scope.setValue('total', price * qty);
  }, 'total')
  .setEnableNarrative()
  .build();

const executor1 = new FlowChartExecutor(chart1);  // ← no scopeFactory!
await executor1.run();

console.log('  Result:', executor1.getSnapshot().sharedState.total);
console.log('  Narrative:');
executor1.getNarrative().forEach((line) => console.log(`    ${line}`));

// ── Pattern 2: Custom scopeFactory (with recorders) ─────────────────
// Use when you need to attach recorders, use redaction, or add middleware.

console.log('\n=== Pattern 2: Custom scopeFactory (with recorder) ===\n');

const recorder = new NarrativeRecorder({ id: 'orders', detail: 'full' });

const customFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(recorder);
  return scope;
};

const chart2 = flowChart('Receive', async (scope: ScopeFacade) => {
  scope.setValue('orderId', 'ORD-42');
  scope.setValue('items', ['Widget', 'Gadget']);
}, 'receive')
  .addFunction('Process', async (scope: ScopeFacade) => {
    const items = scope.getValue('items') as string[];
    scope.setValue('itemCount', items.length);
    scope.setValue('status', 'processed');
  }, 'process')
  .build();

const executor2 = new FlowChartExecutor(chart2, customFactory);  // ← custom factory
await executor2.run();

console.log('  Result:', executor2.getSnapshot().sharedState.status);
console.log('  Recorder captured', recorder.getStageData().size, 'stages');

// ── Pattern 3: Typed ScopeFacade subclass ───────────────────────────
// Use when you want type-safe getters/setters on your scope.

console.log('\n=== Pattern 3: Typed ScopeFacade subclass ===\n');

class OrderScope extends ScopeFacade {
  get orderId(): string { return this.getValue('orderId') as string; }
  set orderId(v: string) { this.setValue('orderId', v); }

  get total(): number { return this.getValue('total') as number; }
  set total(v: number) { this.setValue('total', v); }
}

const typedFactory = (ctx: any, stageName: string) => new OrderScope(ctx, stageName);

const chart3 = flowChart('CreateOrder', async (scope: OrderScope) => {
  // Use setValue — typed setters are intercepted by scope protection.
  // The typed getters work because they call getValue() internally.
  scope.setValue('orderId', 'ORD-99');
  scope.setValue('total', 299.97);
}, 'create-order')
  .addFunction('Confirm', async (scope: OrderScope) => {
    // Typed getters — clean, type-safe reads
    console.log(`  Order ${scope.orderId}: $${scope.total}`);
  }, 'confirm')
  .build();

const executor3 = new FlowChartExecutor(chart3, typedFactory);  // ← typed factory
await executor3.run();

// ── Summary ─────────────────────────────────────────────────────────

console.log('\n=== Summary ===');
console.log('  Pattern 1: new FlowChartExecutor(chart)           — zero boilerplate');
console.log('  Pattern 2: new FlowChartExecutor(chart, factory)  — with recorders');
console.log('  Pattern 3: new FlowChartExecutor(chart, factory)  — typed subclass');

})().catch(console.error);
