/**
 * Feature: DebugRecorder + Mermaid Diagram
 *
 * - DebugRecorder captures every read, write, and error for diagnostics
 * - toMermaid() generates a Mermaid flowchart diagram from the builder
 *
 * Run:  npm run feature:debug
 */

import {
  FlowChartBuilder,
  FlowChartExecutor,
  ScopeFacade,
  DebugRecorder,
} from 'footprint';

(async () => {

const debug = new DebugRecorder('verbose');

// ── Build a pipeline ────────────────────────────────────────────────────

const builder = new FlowChartBuilder()
  .start('Ingest', async (scope: ScopeFacade) => {
    scope.setValue('rawText', 'The quick brown fox jumps over the lazy dog');
    scope.setValue('source', 'user-input');
  })
  .addFunction('Tokenize', async (scope: ScopeFacade) => {
    const text = scope.getValue('rawText') as string;
    const tokens = text.toLowerCase().split(/\s+/);
    scope.setValue('tokens', tokens);
    scope.setValue('tokenCount', tokens.length);
  })
  .addFunction('Analyze', async (scope: ScopeFacade) => {
    const tokens = scope.getValue('tokens') as string[];
    const unique = [...new Set(tokens)];
    scope.setValue('uniqueTokens', unique);
    scope.setValue('uniqueCount', unique.length);
    scope.setValue('duplicateRate', 1 - unique.length / tokens.length);
  });

// ── Generate Mermaid diagram BEFORE build ────────────────────────────────

const mermaid = builder.toMermaid();

console.log('=== Mermaid Flowchart Diagram ===\n');
console.log(mermaid);
console.log('\n  (Paste into https://mermaid.live to render)\n');

// ── Build and run ───────────────────────────────────────────────────────

const chart = builder.build();

const scopeFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(debug);
  return scope;
};

const executor = new FlowChartExecutor(chart, scopeFactory);
await executor.run();

// ── DebugRecorder output ────────────────────────────────────────────────

console.log('=== DebugRecorder — Full Trace ===\n');

const entries = debug.getEntries();
for (const entry of entries) {
  const ts = new Date(entry.timestamp).toISOString().split('T')[1].slice(0, 12);
  if (entry.type === 'write') {
    console.log(`  [${ts}] WRITE ${entry.stageName}: ${entry.data?.key} = ${JSON.stringify(entry.data?.value)}`);
  } else if (entry.type === 'read') {
    console.log(`  [${ts}] READ  ${entry.stageName}: ${entry.data?.key} → ${JSON.stringify(entry.data?.value)}`);
  } else if (entry.type === 'error') {
    console.log(`  [${ts}] ERROR ${entry.stageName}: ${entry.data?.message}`);
  }
}

console.log(`\n  Total entries: ${entries.length} (${entries.filter(e => e.type === 'write').length} writes, ${entries.filter(e => e.type === 'read').length} reads)`);

})().catch(console.error);
