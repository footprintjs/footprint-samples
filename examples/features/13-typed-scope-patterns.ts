/**
 * Feature: TypedScope Patterns
 *
 * Three ways to use TypedScope:
 * 1. typedFlowChart<T>() — simplest, recommended
 * 2. createTypedScopeFactory<T>() — with FlowChartBuilder
 * 3. $-methods — escape hatches for dynamic/advanced use
 *
 * Run:  npm run feature:scope-factory
 * Try it: https://footprintjs.github.io/footprint-playground/samples/optional-scope-factory
 */

import {
  typedFlowChart,
  createTypedScopeFactory,
  FlowChartBuilder,
  FlowChartExecutor,
  MetricRecorder,
} from 'footprint';

interface OrderState {
  orderId: string;
  items: string[];
  itemCount?: number;
  total?: number;
  status?: string;
}

(async () => {

// ── Pattern 1: typedFlowChart<T>() — simplest ──────────────────────────

console.log('=== Pattern 1: typedFlowChart<T>() (recommended) ===\n');

const chart1 = typedFlowChart<OrderState>('Receive', async (scope) => {
  scope.orderId = 'ORD-42';
  scope.items = ['Widget', 'Gadget'];
}, 'receive')
  .addFunction('Process', async (scope) => {
    scope.itemCount = scope.items.length;
    scope.total = scope.itemCount * 29.99;
    scope.status = 'processed';
  }, 'process')
  .setEnableNarrative()
  .build();

const executor1 = new FlowChartExecutor(chart1, createTypedScopeFactory<OrderState>());
await executor1.run();

console.log('  Result:', executor1.getSnapshot().sharedState.status);
console.log('  Narrative:');
executor1.getNarrative().forEach((line) => console.log(`    ${line}`));

// ── Pattern 2: FlowChartBuilder + createTypedScopeFactory ──────────────

console.log('\n=== Pattern 2: FlowChartBuilder + createTypedScopeFactory ===\n');

const chart2 = new FlowChartBuilder<any, import('footprint').TypedScope<OrderState>>()
  .start('Receive', async (scope) => {
    scope.orderId = 'ORD-99';
    scope.items = ['Premium Widget'];
  }, 'receive')
  .addFunction('Process', async (scope) => {
    scope.itemCount = scope.items.length;
    scope.status = 'express';
  }, 'process')
  .build();

const executor2 = new FlowChartExecutor(chart2, createTypedScopeFactory<OrderState>());
const metrics = new MetricRecorder();
executor2.attachRecorder(metrics);
await executor2.run();

console.log('  Result:', executor2.getSnapshot().sharedState.status);
console.log('  Writes:', metrics.getMetrics().totalWrites);

// ── Pattern 3: $-methods for dynamic/advanced use ──────────────────────

console.log('\n=== Pattern 3: $-methods (escape hatches) ===\n');

const chart3 = typedFlowChart<OrderState>('Dynamic', async (scope) => {
  // Use typed access for known fields
  scope.orderId = 'ORD-dynamic';

  // Use $-methods for dynamic keys, redaction, descriptions
  scope.$setValue('dynamicField', 'computed at runtime');
  scope.$setValue('sensitiveData', 'secret-123', true); // redacted

  // $read for precise nested access
  scope.items = ['A', 'B', 'C'];

  // $debug for diagnostics
  scope.$debug('checkpoint', { phase: 'dynamic-setup' });
  scope.$metric('itemCount', 3);
}, 'dynamic')
  .build();

const executor3 = new FlowChartExecutor(chart3, createTypedScopeFactory<OrderState>());
await executor3.run();
console.log('  State:', executor3.getSnapshot().sharedState);

// ── Summary ─────────────────────────────────────────────────────────────

console.log('\n=== Summary ===');
console.log('  Pattern 1: typedFlowChart<T>()                    -- zero boilerplate');
console.log('  Pattern 2: FlowChartBuilder + createTypedScopeFactory -- with recorder attachment');
console.log('  Pattern 3: $-methods                               -- dynamic keys, redaction, diagnostics');

})().catch(console.error);
