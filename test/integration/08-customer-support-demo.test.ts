/**
 * Integration test: Customer Support Demo Pipeline
 *
 * Verifies the demo pipeline API contract before each release:
 *   - All three resolution branches (auto-refund, escalate, manual-review)
 *   - decide() evidence appears in narrative
 *   - All exported symbols are present
 *   - Snapshot for the default demo scenario (Jane Smith duplicate charge)
 */
import { describe, it, expect } from 'vitest';
import {
  runSupportPipeline,
  flowchartSpec,
  defaultTicket,
  type SupportTicket,
  type SupportResult,
} from '../../demos/customer-support';

// ── Helpers ─────────────────────────────────────────────────────────────────

function ticket(overrides: Partial<SupportTicket>): SupportTicket {
  return { ...defaultTicket, ...overrides };
}

// ── Exports ──────────────────────────────────────────────────────────────────

describe('Support demo — exports', () => {
  it('flowchartSpec is present and has root stage name', () => {
    expect(flowchartSpec).toBeDefined();
    expect((flowchartSpec as any).name).toBe('ReceiveTicket');
  });

  it('runSupportPipeline is a function', () => {
    expect(typeof runSupportPipeline).toBe('function');
  });

  it('defaultTicket has required fields', () => {
    expect(defaultTicket.ticketId).toBeDefined();
    expect(defaultTicket.customerEmail).toBeDefined();
    expect(defaultTicket.subject).toBeDefined();
    expect(defaultTicket.body).toBeDefined();
  });
});

// ── Resolution branches ───────────────────────────────────────────────────────

describe('Support demo — resolution branches', () => {
  it('auto-refunds confirmed gateway-timeout duplicate (default demo ticket)', async () => {
    const result = await runSupportPipeline(defaultTicket);
    expect(result.resolutionType).toBe('auto-refund');
    expect(result.resolution).toMatch(/^AUTO-REFUND/);
    expect(result.resolution).toContain('ORD-2847');
  });

  it('escalates when duplicate charge lacks clear root cause', async () => {
    // Use bob.jones who has no matching order in DB → orderFound=false
    // But his ticket body still mentions ORD-2847, so it will find the order...
    // Let's use a known-unknown customer with no order match
    const result = await runSupportPipeline(ticket({
      customerEmail: 'bob.jones@example.com',
      body: 'I was charged twice for ORD-2847. Please help.',
    }));
    // bob.jones finds ORD-2847 (duplicate charge) + has logs for jane's trace (different email)
    // The log search won't find bob's trace since auth log is for jane
    // duplicateChargeDetected will still be set from order lookup
    // rootCauseType depends on log analysis finding the gateway timeout pattern
    // Since no logs are correlated for bob, errorChain will be empty → rootCauseType = 'unknown'
    // duplicateCharge=true but rootCauseType != 'gateway-timeout-duplicate' → escalate
    expect(result.resolutionType).toBe('escalate');
    expect(result.resolution).toMatch(/^ESCALATED/);
  });

  it('routes to manual-review when no duplicate charge detected', async () => {
    const result = await runSupportPipeline(ticket({
      body: 'I have a question about my recent purchase. There is no order number to mention.',
    }));
    expect(result.resolutionType).toBe('manual-review');
    expect(result.resolution).toMatch(/^MANUAL REVIEW/);
  });
});

// ── Result shape ─────────────────────────────────────────────────────────────

describe('Support demo — result shape', () => {
  it('returns all required SupportResult fields', async () => {
    const result: SupportResult = await runSupportPipeline(defaultTicket);
    expect(result.resolution).toBeDefined();
    expect(result.resolutionType).toBeDefined();
    expect(result.category).toBeDefined();
    expect(result.priority).toBeDefined();
    expect(result.customerName).toBeDefined();
    expect(result.customerTier).toBeDefined();
    expect(typeof result.servicesSearched).toBe('number');
    expect(Array.isArray(result.errorChain)).toBe(true);
    expect(Array.isArray(result.narrative)).toBe(true);
    expect(Array.isArray(result.narrativeEntries)).toBe(true);
    expect(result.snapshot).toBeDefined();
    expect(result.runtimeSnapshot).toBeDefined();
  });

  it('classifies billing ticket correctly', async () => {
    const result = await runSupportPipeline(defaultTicket);
    expect(result.category).toBe('billing');
    expect(result.priority).toBe('P1'); // "twice" → urgent
  });

  it('narrative is non-empty', async () => {
    const result = await runSupportPipeline(defaultTicket);
    expect(result.narrative.length).toBeGreaterThan(0);
  });

  it('narrative contains decide() evidence', async () => {
    const result = await runSupportPipeline(defaultTicket);
    const joined = result.narrative.join('\n');
    expect(joined).toContain('[Condition]');
  });

  it('services searched equals 4', async () => {
    const result = await runSupportPipeline(defaultTicket);
    expect(result.servicesSearched).toBe(4);
  });

  it('error chain is non-empty for duplicate charge scenario', async () => {
    const result = await runSupportPipeline(defaultTicket);
    expect(result.errorChain.length).toBeGreaterThan(0);
    expect(result.errorChain.some((e) => e.includes('DUPLICATE'))).toBe(true);
  });
});

// ── Snapshot ─────────────────────────────────────────────────────────────────

describe('Support demo — snapshot (default demo scenario)', () => {
  it('matches snapshot for Jane Smith duplicate charge', async () => {
    const result = await runSupportPipeline(defaultTicket);
    expect({
      resolutionType: result.resolutionType,
      category: result.category,
      priority: result.priority,
      customerName: result.customerName,
      customerTier: result.customerTier,
      servicesSearched: result.servicesSearched,
      errorChainLength: result.errorChain.length,
    }).toMatchSnapshot();
  });
});
