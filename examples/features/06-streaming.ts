/**
 * Feature: Streaming Stages
 *
 * Streaming stages emit tokens incrementally via a StreamCallback.
 * The executor calls lifecycle hooks: onStart → onToken (per token) → onEnd.
 *
 * This simulates an LLM generating a response token-by-token.
 *
 * Run:  npm run feature:streaming
 * Try it: https://footprintjs.github.io/footprint-playground/samples/streaming
 */

import {
  FlowChartBuilder,
  FlowChartExecutor,
  ScopeFacade,
  type StreamHandlers,
} from 'footprint';

(async () => {

// ── Simulate token-by-token LLM generation ──────────────────────────────

const llmTokens = [
  'The ', 'patient ', 'presents ', 'with ', 'elevated ',
  'temperature ', 'of ', '102.6°F, ', 'consistent ', 'with ',
  'a ', 'moderate ', 'fever.',
];

// ── Stream handlers — wire these to your UI / SSE / WebSocket ───────────

const streams: Record<string, string[]> = {};

const streamHandlers: StreamHandlers = {
  onStart: (streamId) => {
    streams[streamId] = [];
    process.stdout.write(`  [${streamId}] streaming: `);
  },
  onToken: (streamId, token) => {
    streams[streamId].push(token);
    process.stdout.write(token); // real-time output
  },
  onEnd: (streamId, fullText) => {
    process.stdout.write('\n');
    console.log(`  [${streamId}] complete: ${fullText?.length ?? 0} chars`);
  },
};

// ── Build the flow with a streaming stage ────────────────────────────────

const chart = new FlowChartBuilder()
  .start('PrepareContext', async (scope: ScopeFacade) => {
    scope.setValue('patientName', 'Jane Doe');
    scope.setValue('temperature', 102.6);
    scope.setValue('unit', 'fahrenheit');
  }, 'prepare-context')
  .addStreamingFunction(
    'GenerateSummary',  // stage name
    async (scope: ScopeFacade, _breakFn, streamCallback) => {
      const name = scope.getValue('patientName') as string;
      const temp = scope.getValue('temperature') as number;

      // Simulate LLM streaming — emit tokens with delay
      for (const token of llmTokens) {
        await new Promise((r) => setTimeout(r, 30));
        streamCallback?.(token);
      }

      // Set the final result in scope
      scope.setValue('summary', llmTokens.join(''));
    },
    'generate-summary',  // id
    'llm-summary',       // stream ID (used in onStart/onToken/onEnd)
  )
  .addFunction('SaveReport', async (scope: ScopeFacade) => {
    const summary = scope.getValue('summary') as string;
    scope.setValue('saved', true);
    scope.setValue('reportLength', summary.length);
  }, 'save-report')
  .build();

const executor = new FlowChartExecutor(
  chart,
  undefined, // scopeFactory — uses default ScopeFacade
  undefined, // defaultValuesForContext
  undefined, // initialContext
  undefined, // readOnlyContext
  undefined, // throttlingErrorChecker
  streamHandlers,
);

console.log('=== Streaming Stage (LLM simulation) ===\n');
await executor.run();

console.log(`\n  Tokens captured: ${streams['llm-summary']?.length ?? 0}`);

})().catch(console.error);
