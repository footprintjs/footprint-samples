/**
 * Flowchart: Structural-Only Dynamic Subflow (Pre-Executed Subflow)
 *
 * Sometimes an inner flow has already executed before the parent flow runs.
 * For example, in HTTP request tracing, the route handler executes business
 * logic (an inner flowchart), and the request wrapper flow runs afterward
 * to capture the trace. The inner flow is done — we just need its structure
 * attached for visualization.
 *
 * The HANDLER stage returns a StageNode with:
 *   - isSubflowRoot: true
 *   - subflowDef.buildTimeStructure (the inner flow's shape)
 *   - NO subflowDef.root (no execution — the flow already ran)
 *
 * The engine's Phase 4 detects this and annotates the runtime structure
 * without invoking SubflowExecutor. Zero scope leakage, zero execution.
 *
 *   Parent:  REQUEST_START → HANDLER [structural: Validate-Input → Create-Grade] → RESPONSE
 *   Inner:   (already executed — only the structure is attached)
 */

import { typedFlowChart, FlowChartExecutor } from 'footprint';

(async () => {

// ── Simulate an inner flow that already executed ────────────────────────

// In a real system, the inner flow (e.g., SchoolFootprint's create-grade)
// ran during the route handler. We only have its buildTimeStructure.
const innerFlowResult = {
  flowId: 'create-grade',
  description: 'Create a grade record with validation',
  buildTimeStructure: {
    name: 'Validate-Input',
    id: 'validate-input',
    type: 'stage' as const,
    description: 'Validate that required Grade fields are present',
    next: {
      name: 'Create-Grade',
      id: 'create-grade',
      type: 'stage' as const,
      description: 'Create the Grade record in the repository',
    },
  },
  result: { gradeName: 'Grade 11', gradeCode: 'G11' },
};

// ── Parent Flow (Request Wrapper) ───────────────────────────────────────

const chart = new FlowChartBuilder()
  .setEnableNarrative()
  .start(
    'REQUEST_START',
    (scope: any) => {
      scope['method'] = 'POST');
      scope['path'] = '/v2/grades');
      scope['requestId'] = 'req-' + Date.now());
    },
    'request-start',
    'Capture request metadata and assign correlation ID',
  )
  .addFunction(
    'HANDLER',
    (scope: any) => {
      // The route handler already executed the inner flow.
      // Record the result in scope for downstream stages.
      scope['handlerResult'] = innerFlowResult.result);
      scope['statusCode'] = 201);

      // Return a structural-only dynamic subflow:
      // - isSubflowRoot: true  → marks this node as a subflow mount point
      // - subflowDef.buildTimeStructure → the inner flow's shape for visualization
      // - NO subflowDef.root → signals "don't execute, just annotate"
      return {
        name: 'HANDLER',
        id: 'handler',
        isSubflowRoot: true,
        subflowId: innerFlowResult.flowId,
        subflowName: innerFlowResult.flowId,
        description: innerFlowResult.description,
        subflowDef: {
          buildTimeStructure: innerFlowResult.buildTimeStructure,
          // No `root` — this is the structural-only signal
        },
      };
    },
    'handler',
    'Execute the route handler — the actual service business logic for this request.',
  )
  .addFunction(
    'RESPONSE',
    (scope: any) => {
      const statusCode = scope['statusCode'];
      scope['outcome'] = statusCode < 400 ? 'success' : 'error');
    },
    'response',
    'Classify and finalize the HTTP response.',
  )
  .build();

// ── Run ─────────────────────────────────────────────────────────────────

const executor = new FlowChartExecutor(chart);
await executor.run();

console.log('\n=== Structural-Only Dynamic Subflow ===\n');

// Narrative — no subflow entry/exit markers (the inner flow didn't execute here)
executor.getNarrative().forEach((line) => console.log(`  ${line}`));

// Runtime structure — HANDLER node is annotated with the inner flow's structure
const structure = executor.getRuntimeStructure() as any;
function findNode(node: any, targetId: string): any {
  if (!node) return null;
  if (node.id === targetId) return node;
  const fromNext = findNode(node.next, targetId);
  if (fromNext) return fromNext;
  for (const child of node.children ?? []) {
    const found = findNode(child, targetId);
    if (found) return found;
  }
  return null;
}
const handlerNode = findNode(structure, 'handler');

console.log('\n  HANDLER node annotation:');
console.log(`    isSubflowRoot: ${handlerNode?.isSubflowRoot}`);
console.log(`    subflowId: ${handlerNode?.subflowId}`);
console.log(`    subflowStructure: ${JSON.stringify(handlerNode?.subflowStructure, null, 6)}`);

// No SubflowResults — the engine never invoked SubflowExecutor
console.log(`\n  SubflowResults count: ${executor.getSubflowResults().size} (expected: 0)`);

// Scope is clean — only parent flow's values
const snap = executor.getSnapshot();
console.log(`  Handler result: ${JSON.stringify(snap?.sharedState?.handlerResult)}`);
console.log(`  Outcome: ${snap?.sharedState?.outcome}`);

})().catch(console.error);
