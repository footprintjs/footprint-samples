/**
 * Feature: DebugRecorder + Mermaid Diagram
 *
 * - DebugRecorder captures every read, write, and error for diagnostics
 * - toMermaid() generates a Mermaid flowchart diagram from the builder
 *
 * Run:  npm run feature:debug
 * Try it: https://footprintjs.github.io/footprint-playground/samples/debug-mermaid
 */

import {
  typedFlowChart,
  createTypedScopeFactory,
  FlowChartExecutor,
  DebugRecorder,
} from 'footprint';

interface TextState {
  rawText: string;
  source: string;
  tokens?: string[];
  tokenCount?: number;
  uniqueTokens?: string[];
  uniqueCount?: number;
  duplicateRate?: number;
}

(async () => {

const debug = new DebugRecorder({ verbosity: 'verbose' });

const builder = typedFlowChart<TextState>('Ingest', async (scope) => {
  scope.rawText = 'The quick brown fox jumps over the lazy dog';
  scope.source = 'user-input';
}, 'ingest')
  .addFunction('Tokenize', async (scope) => {
    scope.tokens = scope.rawText.toLowerCase().split(/\s+/);
    scope.tokenCount = scope.tokens.length;
  }, 'tokenize')
  .addFunction('Analyze', async (scope) => {
    const unique = [...new Set(scope.tokens!)];
    scope.uniqueTokens = unique;
    scope.uniqueCount = unique.length;
    scope.duplicateRate = 1 - unique.length / scope.tokens!.length;
  }, 'analyze');

// Generate Mermaid diagram BEFORE build
const mermaid = builder.toMermaid();

console.log('=== Mermaid Flowchart Diagram ===\n');
console.log(mermaid);
console.log('\n  (Paste into https://mermaid.live to render)\n');

const chart = builder.build();

const executor = new FlowChartExecutor(chart, createTypedScopeFactory<TextState>());
executor.attachRecorder(debug);
await executor.run();

console.log('=== DebugRecorder — Full Trace ===\n');

const entries = debug.getEntries();
for (const entry of entries) {
  const ts = new Date(entry.timestamp).toISOString().split('T')[1].slice(0, 12);
  if (entry.type === 'write') {
    console.log(`  [${ts}] WRITE ${entry.stageName}: ${(entry.data as any)?.key} = ${JSON.stringify((entry.data as any)?.value)}`);
  } else if (entry.type === 'read') {
    console.log(`  [${ts}] READ  ${entry.stageName}: ${(entry.data as any)?.key}`);
  }
}

console.log(`\n  Total entries: ${entries.length}`);

})().catch(console.error);
