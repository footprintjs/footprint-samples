/**
 * Feature: Subflow Manifest — Lightweight catalog for LLM navigation.
 *
 * ManifestFlowRecorder builds a tree of subflow IDs + descriptions
 * as a side effect of traversal. An LLM receiving a snapshot can:
 *   1. Read the manifest to understand which subflows exist
 *   2. Pull full specs on demand for any subflow it wants to explore
 *
 * This example shows:
 *   - Attaching ManifestFlowRecorder to an executor
 *   - Reading the manifest tree after execution
 *   - Using executor convenience methods (getSubflowManifest)
 *   - StageSnapshot enrichment with description and subflowId
 */

import {
  FlowChartBuilder,
  FlowChartExecutor,
  ManifestFlowRecorder,
  ScopeFacade,
} from 'footprint';
import type { ManifestEntry } from 'footprint';

(async () => {

// ── Stage Functions ───────────────────────────────────────────────────

const receiveOrder = async (scope: ScopeFacade) => {
  scope.setValue('orderId', 'ORD-100');
  scope.setValue('amount', 249.99);
  scope.setValue('cardLast4', '1234');
};

const validateCard = async (scope: ScopeFacade) => {
  const last4 = scope.getValue('cardLast4') as string;
  scope.setValue('cardValid', last4.length === 4);
};

const chargeCard = async (scope: ScopeFacade) => {
  const amount = scope.getValue('amount') as number;
  scope.setValue('charged', amount < 10_000);
  scope.setValue('txnId', 'TXN-' + Date.now());
};

const checkInventory = async (scope: ScopeFacade) => {
  scope.setValue('inStock', true);
  scope.setValue('warehouse', 'WH-West');
};

const reserveStock = async (scope: ScopeFacade) => {
  const warehouse = scope.getValue('warehouse') as string;
  scope.setValue('reserved', true);
  scope.setValue('reservationId', `RSV-${warehouse}-${Date.now()}`);
};

const shipOrder = async (scope: ScopeFacade) => {
  scope.setValue('shipped', true);
};

// ── Build Subflows ────────────────────────────────────────────────────

const paymentSubflow = new FlowChartBuilder()
  .start('ValidateCard', validateCard, 'validate-card', 'Verify card details')
  .addFunction('ChargeCard', chargeCard, 'charge-card', 'Charge the card')
  .build();

const inventorySubflow = new FlowChartBuilder()
  .start('CheckInventory', checkInventory, 'check-inventory', 'Look up warehouse stock')
  .addFunction('ReserveStock', reserveStock, 'reserve-stock', 'Reserve units')
  .build();

// ── Build Parent Flowchart ────────────────────────────────────────────

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start('ReceiveOrder', receiveOrder, 'receive-order', 'Ingest order and customer data')
  .addSubFlowChartNext('sf-payment', paymentSubflow, 'Payment', {
    inputMapper: (s: any) => ({ amount: s.amount, cardLast4: s.cardLast4 }),
  })
  .addSubFlowChartNext('sf-inventory', inventorySubflow, 'Inventory')
  .addFunction('ShipOrder', shipOrder, 'ship-order', 'Dispatch shipment')
  .build();

// ── Execute with ManifestFlowRecorder ─────────────────────────────────

const executor = new FlowChartExecutor(chart);
const manifest = new ManifestFlowRecorder();
executor.attachFlowRecorder(manifest);

await executor.run();

// ── 1. Read the manifest tree ─────────────────────────────────────────

console.log('=== Subflow Manifest ===\n');

function printManifest(entries: ManifestEntry[], indent = 0) {
  for (const entry of entries) {
    const pad = '  '.repeat(indent);
    const desc = entry.description ? ` — ${entry.description}` : '';
    console.log(`${pad}  [${entry.subflowId}] ${entry.name}${desc}`);
    if (entry.children.length > 0) {
      printManifest(entry.children, indent + 1);
    }
  }
}

printManifest(manifest.getManifest());

// ── 2. Executor convenience methods ───────────────────────────────────

console.log('\n=== Convenience Methods ===\n');
const entries = executor.getSubflowManifest();
console.log(`  Subflow count: ${entries.length}`);
for (const e of entries) {
  console.log(`  - ${e.name} (${e.subflowId})`);
}

// ── 3. StageSnapshot enrichment ───────────────────────────────────────

console.log('\n=== Snapshot Enrichment ===\n');
const snapshot = executor.getSnapshot();
const tree = snapshot.executionTree;

// Walk the tree and print description + subflowId where present
function walkSnapshot(node: any, depth = 0) {
  if (!node) return;
  const pad = '  '.repeat(depth);
  const label = node.name || node.id || '(unnamed)';
  const desc = node.description ? ` — "${node.description}"` : '';
  const sfId = node.subflowId ? ` [subflow: ${node.subflowId}]` : '';
  console.log(`${pad}  ${label}${desc}${sfId}`);
  if (node.children) {
    for (const child of node.children) {
      walkSnapshot(child, depth + 1);
    }
  }
  if (node.next) walkSnapshot(node.next, depth);
}

walkSnapshot(tree);

// ── 4. Narrative ──────────────────────────────────────────────────────

console.log('\n=== Narrative ===\n');
for (const line of executor.getNarrative()) {
  console.log(`  ${line}`);
}

// ── 5. Multi-run: manifest resets between runs ────────────────────────

console.log('\n=== Multi-run Reset ===\n');
await executor.run();
const secondRun = manifest.getManifest();
console.log(`  After 2nd run: ${secondRun.length} entries (same as 1st — no accumulation)`);

})().catch(console.error);
