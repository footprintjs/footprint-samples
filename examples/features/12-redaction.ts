/**
 * Feature: PII Redaction
 *
 * When pipelines handle sensitive data (passwords, API keys, credit cards),
 * you don't want those values leaking into narratives, debug logs, or audit trails.
 *
 * Pass `shouldRedact = true` to `setValue()` — recorders see `[REDACTED]`,
 * but the runtime still gets the real value.
 *
 * Run:  npm run feature:redaction
 */

import {
  flowChart,
  FlowChartExecutor,
  ScopeFacade,
  DebugRecorder,
  NarrativeRecorder,
  MetricRecorder,
  type Recorder,
  type WriteEvent,
  type ReadEvent,
} from 'footprint';

(async () => {
  // ── 1. Basic redaction ─────────────────────────────────────────────────

  console.log('=== 1. Basic Redaction ===\n');

  const chart = flowChart('CollectCredentials', async (scope: ScopeFacade) => {
    // Public data — visible to recorders
    scope.setValue('userId', 'user-42');
    scope.setValue('email', 'alice@example.com');

    // Sensitive data — redacted in recorder output
    scope.setValue('password', 'P@ssw0rd!S3cret', true);
    scope.setValue('ssn', '123-45-6789', true);
    scope.setValue('apiKey', 'sk-live-abc123xyz789', true);
  })
    .addFunction('Authenticate', async (scope: ScopeFacade) => {
      // Runtime gets the REAL values — business logic works normally
      const password = scope.getValue('password') as string;
      const apiKey = scope.getValue('apiKey') as string;

      scope.setValue('authenticated', password.length > 8 && apiKey.startsWith('sk-'));
      scope.setValue('tokenHash', 'sha256:a1b2c3d4e5f6', true); // also redacted
    })
    .addFunction('Authorize', async (scope: ScopeFacade) => {
      const authenticated = scope.getValue('authenticated') as boolean;
      const userId = scope.getValue('userId') as string;
      scope.setValue('permissions', authenticated ? ['read', 'write'] : ['read']);
      scope.setValue('sessionToken', `sess-${userId}-${Date.now()}`, true);
    })
    .setEnableNarrative()
    .build();

  const executor = new FlowChartExecutor(chart, (ctx: any, name: string) => new ScopeFacade(ctx, name));
  await executor.run();

  console.log('Narrative (notice redacted values):\n');
  console.log(executor.getNarrative());

  // ── 2. All recorder types see redacted values ──────────────────────────

  console.log('\n=== 2. Recorder-Specific Output ===\n');

  const narrative = new NarrativeRecorder({ id: 'n1' });
  const debug = new DebugRecorder({ id: 'd1', verbosity: 'verbose' });
  const metrics = new MetricRecorder('m1');

  const chart2 = flowChart('ProcessPayment', async (scope: ScopeFacade) => {
    scope.setValue('cardNumber', '4111-1111-1111-1111', true);
    scope.setValue('cvv', '123', true);
    scope.setValue('amount', 99.99);
    scope.setValue('currency', 'USD');
  })
    .build();

  const scopeFactory = (ctx: any, stageName: string) => {
    const scope = new ScopeFacade(ctx, stageName);
    scope.attachRecorder(narrative);
    scope.attachRecorder(debug);
    scope.attachRecorder(metrics);
    return scope;
  };

  const executor2 = new FlowChartExecutor(chart2, scopeFactory);
  await executor2.run();

  // NarrativeRecorder
  console.log('NarrativeRecorder sentences:');
  for (const [stage, lines] of narrative.toSentences()) {
    console.log(`  ${stage}:`);
    lines.forEach((l) => console.log(`  ${l}`));
  }

  // DebugRecorder
  console.log('\nDebugRecorder entries:');
  for (const entry of debug.getEntries()) {
    const data = entry.data as Record<string, unknown>;
    console.log(`  [${entry.type}] ${data.key} = ${JSON.stringify(data.value)}`);
  }

  // MetricRecorder (counts only — safe by default)
  console.log('\nMetricRecorder (counts, no values):');
  const m = metrics.getMetrics();
  console.log(`  Total writes: ${m.totalWrites}`);
  console.log(`  Total reads: ${m.totalReads}`);

  // ── 3. Custom compliance recorder using redacted flag ──────────────────

  console.log('\n=== 3. Custom Compliance Recorder ===\n');

  class ComplianceRecorder implements Recorder {
    readonly id = 'compliance';
    private piiFields: string[] = [];
    private publicFields: string[] = [];

    onWrite(event: WriteEvent): void {
      if (event.redacted) {
        this.piiFields.push(event.key);
      } else {
        this.publicFields.push(event.key);
      }
    }

    onRead(event: ReadEvent): void {
      if (event.redacted) {
        // Log PII access for compliance audit
        console.log(`  [AUDIT] PII field accessed: ${event.key} at ${new Date(event.timestamp).toISOString()}`);
      }
    }

    report(): void {
      console.log(`  PII fields (${this.piiFields.length}): ${this.piiFields.join(', ')}`);
      console.log(`  Public fields (${this.publicFields.length}): ${this.publicFields.join(', ')}`);
    }
  }

  const compliance = new ComplianceRecorder();

  const chart3 = flowChart('KYC', async (scope: ScopeFacade) => {
    scope.setValue('fullName', 'Alice Johnson');
    scope.setValue('dateOfBirth', '1990-01-15', true);
    scope.setValue('taxId', '987-65-4321', true);
    scope.setValue('address', '123 Main St');
    scope.setValue('bankAccount', 'IBAN-DE89370400440532013000', true);
  })
    .addFunction('Verify', async (scope: ScopeFacade) => {
      // These reads trigger onRead — PII reads are flagged
      scope.getValue('taxId');
      scope.getValue('bankAccount');
      scope.getValue('fullName');
      scope.setValue('verified', true);
    })
    .build();

  const scopeFactory3 = (ctx: any, stageName: string) => {
    const scope = new ScopeFacade(ctx, stageName);
    scope.attachRecorder(compliance);
    return scope;
  };

  const executor3 = new FlowChartExecutor(chart3, scopeFactory3);
  await executor3.run();

  console.log('\n  Compliance report:');
  compliance.report();

  // ── 4. Redaction lifecycle ─────────────────────────────────────────────

  console.log('\n=== 4. Redaction Lifecycle ===\n');

  const chart4 = flowChart('Lifecycle', async (scope: ScopeFacade) => {
    // 1. Set as redacted
    scope.setValue('token', 'secret-bearer-token', true);
    console.log('  After setValue with redact=true:');
    console.log(`    Runtime getValue: "${scope.getValue('token')}"`);

    // 2. Update — stays redacted (key was marked sensitive)
    scope.updateValue('token', 'rotated-bearer-token');
    console.log('  After updateValue (stays redacted in recorders):');
    console.log(`    Runtime getValue: "${scope.getValue('token')}"`);

    // 3. Delete — clears redaction status
    scope.deleteValue('token');

    // 4. Re-set without redaction — now visible
    scope.setValue('token', 'new-public-token');
    console.log('  After delete + re-set without redact:');
    console.log(`    Runtime getValue: "${scope.getValue('token')}"`);
    console.log('    Recorders now see the real value (no longer redacted)');
  })
    .build();

  const writeEvents: WriteEvent[] = [];
  const readEvents: ReadEvent[] = [];
  const scopeFactory4 = (ctx: any, stageName: string) => {
    const scope = new ScopeFacade(ctx, stageName);
    scope.attachRecorder({
      id: 'spy',
      onWrite: (e) => writeEvents.push(e),
      onRead: (e) => readEvents.push(e),
    });
    return scope;
  };

  const executor4 = new FlowChartExecutor(chart4, scopeFactory4);
  await executor4.run();

  console.log('\n  Recorder saw these write values:');
  writeEvents.forEach((e) => {
    const flag = e.redacted ? ' (REDACTED)' : '';
    console.log(`    ${e.operation} ${e.key} = ${JSON.stringify(e.value)}${flag}`);
  });

  console.log('\n  Recorder saw these read values:');
  readEvents.forEach((e) => {
    const flag = e.redacted ? ' (REDACTED)' : '';
    console.log(`    read ${e.key} = ${JSON.stringify(e.value)}${flag}`);
  });

  // ── 5. Config-based redaction with typed scope ─────────────────────────

  console.log('\n=== 5. Config-Based Redaction (Typed Scope Pattern) ===\n');

  // Define which fields are sensitive once — at the scope class level.
  // Stage functions just call typed setters; redaction happens automatically.

  class PatientScope extends ScopeFacade {
    // Config: which fields are PII — define once, applied everywhere
    private static readonly SENSITIVE_FIELDS = new Set([
      'ssn', 'dateOfBirth', 'medicalRecord', 'insuranceId',
    ]);

    // Typed setter that auto-redacts based on config
    setField(key: string, value: unknown): void {
      this.setValue(key, value, PatientScope.SENSITIVE_FIELDS.has(key));
    }

    // Typed getters for clean reads
    get patientName(): string { return this.getValue('patientName') as string; }
    get ssn(): string { return this.getValue('ssn') as string; }
    get diagnosis(): string { return this.getValue('diagnosis') as string; }
    get medicalRecord(): string { return this.getValue('medicalRecord') as string; }
  }

  const chart5 = flowChart('Intake', async (scope: ScopeFacade) => {
    const ps = scope as PatientScope;
    // Developers just call setField — no need to remember which fields are PII
    ps.setField('patientName', 'Bob Smith');
    ps.setField('ssn', '987-65-4321');           // auto-redacted by config
    ps.setField('diagnosis', 'Seasonal allergies');
    ps.setField('medicalRecord', 'MR-2024-1234'); // auto-redacted by config
  })
    .addFunction('Review', async (scope: ScopeFacade) => {
      const ps = scope as PatientScope;
      // Runtime still gets real values via typed getters
      console.log(`  Reviewing patient: ${ps.patientName}`);
      console.log(`  SSN (runtime): ${ps.ssn}`);
      console.log(`  Diagnosis: ${ps.diagnosis}`);
    })
    .setEnableNarrative()
    .build();

  const executor5 = new FlowChartExecutor(
    chart5,
    (ctx: any, name: string) => new PatientScope(ctx, name),
  );
  await executor5.run();

  console.log('\n  Narrative (PII auto-redacted by config):');
  const narrativeLines = executor5.getNarrative() as string[];
  narrativeLines.forEach((line) => console.log(`    ${line}`));

  console.log('\n  Key insight: developers never manually pass `true` —');
  console.log('  the scope class config handles it automatically.');

  // ── 6. RedactionPolicy — declarative, config-driven ───────────────────

  console.log('\n=== 6. RedactionPolicy (Config-Driven) ===\n');

  // Define once at the executor level — no per-call flags needed.
  // Covers exact keys, regex patterns, and field-level scrubbing.

  const chart6 = flowChart('Register', async (scope: ScopeFacade) => {
    // Just write values — the policy handles redaction automatically
    scope.setValue('ssn', '999-88-7777');
    scope.setValue('email', 'alice@example.com');
    scope.setValue('dbPassword', 'hunter2');
    scope.setValue('authToken', 'bearer-xyz-789');
    scope.setValue('patient', {
      name: 'Alice Johnson',
      ssn: '999-88-7777',
      dob: '1990-05-15',
      bloodType: 'O+',
      address: { street: '123 Main St', city: 'LA', zip: '90210' },
    });
  })
    .addFunction('Process', async (scope: ScopeFacade) => {
      // Runtime gets real values — business logic works normally
      const ssn = scope.getValue('ssn') as string;
      const patient = scope.getValue('patient') as Record<string, unknown>;
      scope.setValue('verified', ssn.length > 0 && patient.name !== undefined);
    })
    .setEnableNarrative()
    .build();

  const executor6 = new FlowChartExecutor(
    chart6,
    (ctx: any, name: string) => new ScopeFacade(ctx, name),
  );

  // One config, three dimensions:
  executor6.setRedactionPolicy({
    keys: ['ssn'],                                // exact key match
    patterns: [/password|token|secret/i],          // regex pattern match
    fields: { patient: ['ssn', 'dob', 'address.zip'] }, // dot-notation for nested fields
  });

  await executor6.run();

  console.log('Narrative (policy auto-redacts):');
  const narrative6 = executor6.getNarrative() as string[];
  narrative6.forEach((line) => console.log(`  ${line}`));

  // Audit trail — compliance-friendly, never includes values
  const report = executor6.getRedactionReport();
  console.log('\nRedaction Report (audit trail):');
  console.log(`  Redacted keys: ${report.redactedKeys.join(', ')}`);
  console.log(`  Field redactions: ${JSON.stringify(report.fieldRedactions)}`);
  console.log(`  Patterns: ${report.patterns.join(', ')}`);

  console.log('\n  Key insight: zero per-call flags — one policy config');
  console.log('  covers exact keys, regex patterns, and field-level scrubbing.');
  console.log('  Dot-notation (address.zip) reaches nested fields automatically.');
})().catch(console.error);
