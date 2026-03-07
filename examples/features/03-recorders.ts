/**
 * Feature: Custom Recorders
 *
 * Recorders observe scope operations (read, write, commit, errors).
 * You can build audit logs, compliance trails, or custom telemetry
 * by implementing the Recorder interface.
 *
 * Run:  npm run feature:recorders
 */

import {
  flowChart,
  FlowChartExecutor,
  ScopeFacade,
  type Recorder,
  type ReadEvent,
  type WriteEvent,
  type CommitEvent,
} from 'footprint';

(async () => {

// ── Custom audit recorder ───────────────────────────────────────────────

class AuditRecorder implements Recorder {
  private log: string[] = [];

  onWrite(event: WriteEvent): void {
    this.log.push(
      `[WRITE] ${event.stageName}: ${event.key} = ${JSON.stringify(event.value)}`,
    );
  }

  onRead(event: ReadEvent): void {
    this.log.push(
      `[READ]  ${event.stageName}: ${event.key} → ${JSON.stringify(event.value)}`,
    );
  }

  onCommit(event: CommitEvent): void {
    this.log.push(
      `[COMMIT] ${event.stageName}: ${event.mutations.length} mutation(s)`,
    );
  }

  getLog(): string[] {
    return this.log;
  }
}

// ── Flow ────────────────────────────────────────────────────────────────

const auditRecorder = new AuditRecorder();

const chart = flowChart('Input', async (scope: ScopeFacade) => {
  scope.setValue('userId', 'u-123');
  scope.setValue('action', 'purchase');
  scope.setValue('amount', 99.99);
})
  .addFunction('Validate', async (scope: ScopeFacade) => {
    const amount = scope.getValue('amount') as number;
    scope.setValue('valid', amount > 0 && amount < 10_000);
  })
  .addFunction('Process', async (scope: ScopeFacade) => {
    const valid = scope.getValue('valid') as boolean;
    const userId = scope.getValue('userId') as string;
    scope.setValue('result', valid ? `Processed for ${userId}` : 'Rejected');
  })
  .build();

const scopeFactory = (ctx: any, stageName: string) => {
  const scope = new ScopeFacade(ctx, stageName);
  scope.attachRecorder(auditRecorder);
  return scope;
};

const executor = new FlowChartExecutor(chart, scopeFactory);
await executor.run();

console.log('=== Custom Audit Recorder ===\n');
auditRecorder.getLog().forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
