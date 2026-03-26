/**
 * Demo: Customer Support Triage Pipeline
 *
 * AI-assisted ticket routing using TypedScope<T>.
 * Exported as a module — no IIFE, no console.log.
 * Imported by the demo app UI directly.
 *
 * Stages: ReceiveTicket → ClassifyTicket → (fork) LookupCustomer + LookupOrder + SearchLogs
 *       → BuildErrorChain → MergeFindings → ResolutionDecision
 *         ├─ AutoRefund
 *         ├─ Escalate
 *         └─ ManualReview
 */

import { flowChart, FlowChartExecutor, decide } from 'footprint';

// ── Public types ────────────────────────────────────────────────────────────

export interface SupportTicket {
  ticketId: string;
  customerEmail: string;
  subject: string;
  body: string;
  timestamp: string;
}

export interface SupportResult {
  resolution: string;
  resolutionType: 'auto-refund' | 'escalate' | 'manual-review';
  category: string;
  priority: string;
  customerName: string;
  customerTier: string;
  orderAmount: number;
  errorChain: string[];
  logCount: number;
  servicesSearched: number;
  narrative: string[];
  narrativeEntries: unknown[];
  snapshot: Record<string, unknown>;
  runtimeSnapshot: unknown;
}

// ── Internal types ──────────────────────────────────────────────────────────

interface PaymentAttempt {
  timestamp: string;
  status: string;
  gateway: string;
  amount: number;
}

interface LogEntry {
  timestamp: string;
  service: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

// ── Internal state ──────────────────────────────────────────────────────────

interface SupportState {
  ticketId: string;
  customerEmail: string;
  subject: string;
  body: string;
  receivedAt: string;
  // Classification
  category: string;
  priority: string;
  classificationConfidence: number;
  urgentFlag: boolean;
  // Customer lookup
  crmAttempt: number;
  customerFound: boolean;
  customerName: string;
  customerTier: string;
  accountAge?: number;
  totalOrders?: number;
  openTickets?: number;
  paymentMethod?: string;
  // Order lookup
  orderFound: boolean;
  extractedOrderId?: string;
  orderId?: string;
  orderAmount?: number;
  orderStatus?: string;
  orderItems?: string[];
  paymentAttempts?: PaymentAttempt[];
  chargeCount?: number;
  totalCharged?: number;
  duplicateChargeDetected?: boolean;
  overchargeAmount?: number;
  // Log analysis
  servicesSearched: number;
  totalLogsScanned: number;
  correlatedTraceId: string;
  relevantLogs: LogEntry[];
  relevantLogCount: number;
  orderRelatedLogCount?: number;
  // Error chain
  errorChain: string[];
  errorCount: number;
  rootCause: string;
  rootCauseService?: string;
  rootCauseType: string;
  // Resolution
  findingSummary: Record<string, unknown>;
  refundAmount?: number;
  refundStatus?: string;
  resolution: string;
  resolutionType: string;
  escalatedTo?: string;
  assignedTo?: string;
}

// ── Mock databases ──────────────────────────────────────────────────────────

const customerDB: Record<string, {
  name: string;
  tier: 'standard' | 'gold' | 'vip';
  accountAge: number;
  totalOrders: number;
  openTickets: number;
  recentComplaints: number;
  paymentMethod: string;
}> = {
  'jane.smith@example.com': {
    name: 'Jane Smith',
    tier: 'vip',
    accountAge: 36,
    totalOrders: 147,
    openTickets: 0,
    recentComplaints: 0,
    paymentMethod: 'Visa ending 4242',
  },
  'bob.jones@example.com': {
    name: 'Bob Jones',
    tier: 'standard',
    accountAge: 3,
    totalOrders: 5,
    openTickets: 2,
    recentComplaints: 1,
    paymentMethod: 'Mastercard ending 8888',
  },
};

const orderDB: Record<string, {
  orderId: string;
  amount: number;
  status: string;
  items: string[];
  paymentAttempts: PaymentAttempt[];
}> = {
  'ORD-2847': {
    orderId: 'ORD-2847',
    amount: 189.99,
    status: 'completed',
    items: ['Wireless Headphones', 'USB-C Cable'],
    paymentAttempts: [
      { timestamp: '2026-03-12T14:23:01Z', status: 'timeout', gateway: 'stripe', amount: 189.99 },
      { timestamp: '2026-03-12T14:23:08Z', status: 'success', gateway: 'stripe', amount: 189.99 },
      { timestamp: '2026-03-12T14:23:09Z', status: 'success', gateway: 'stripe', amount: 189.99 },
    ],
  },
};

const scatteredLogs: LogEntry[] = [
  { timestamp: '2026-03-12T14:22:55Z', service: 'auth-service', level: 'info',
    message: 'User jane.smith@example.com authenticated via OAuth', traceId: 'tr-9a3f' },
  { timestamp: '2026-03-12T14:22:56Z', service: 'auth-service', level: 'info',
    message: 'Session created: sess-44bf2', traceId: 'tr-9a3f' },
  { timestamp: '2026-03-12T14:23:00Z', service: 'payment-service', level: 'info',
    message: 'Payment initiated for ORD-2847: $189.99', traceId: 'tr-9a3f',
    metadata: { orderId: 'ORD-2847', amount: 189.99, gateway: 'stripe' } },
  { timestamp: '2026-03-12T14:23:01Z', service: 'payment-service', level: 'error',
    message: 'Gateway timeout: Stripe did not respond within 5000ms', traceId: 'tr-9a3f',
    metadata: { orderId: 'ORD-2847', errorCode: 'GATEWAY_TIMEOUT', retryable: true } },
  { timestamp: '2026-03-12T14:23:03Z', service: 'payment-service', level: 'warn',
    message: 'Retry #1 for ORD-2847 — previous attempt status unknown', traceId: 'tr-9a3f',
    metadata: { orderId: 'ORD-2847', retryCount: 1 } },
  { timestamp: '2026-03-12T14:23:08Z', service: 'payment-service', level: 'info',
    message: 'Payment SUCCESS for ORD-2847: $189.99 (charge ch_7x2k)', traceId: 'tr-9a3f',
    metadata: { orderId: 'ORD-2847', chargeId: 'ch_7x2k' } },
  { timestamp: '2026-03-12T14:23:09Z', service: 'payment-service', level: 'warn',
    message: 'Late response from original attempt: Stripe confirms charge ch_6m1j for ORD-2847',
    traceId: 'tr-9a3f',
    metadata: { orderId: 'ORD-2847', chargeId: 'ch_6m1j', lateResponse: true } },
  { timestamp: '2026-03-12T14:23:09Z', service: 'payment-service', level: 'error',
    message: 'DUPLICATE CHARGE detected: ORD-2847 has 2 successful charges (ch_6m1j + ch_7x2k)',
    traceId: 'tr-9a3f',
    metadata: { orderId: 'ORD-2847', charges: ['ch_6m1j', 'ch_7x2k'], totalCharged: 379.98 } },
  { timestamp: '2026-03-12T14:23:10Z', service: 'order-service', level: 'info',
    message: 'Order ORD-2847 marked as completed', traceId: 'tr-9a3f' },
  { timestamp: '2026-03-12T14:23:11Z', service: 'notification-service', level: 'info',
    message: 'Confirmation email sent to jane.smith@example.com for ORD-2847', traceId: 'tr-9a3f' },
  { timestamp: '2026-03-12T14:23:12Z', service: 'notification-service', level: 'warn',
    message: 'Duplicate payment webhook received — second confirmation suppressed', traceId: 'tr-9a3f' },
  // Unrelated noise
  { timestamp: '2026-03-12T14:23:05Z', service: 'auth-service', level: 'info',
    message: 'User mike@example.com authenticated', traceId: 'tr-bb22' },
  { timestamp: '2026-03-12T14:23:06Z', service: 'payment-service', level: 'info',
    message: 'Payment SUCCESS for ORD-2850: $42.00', traceId: 'tr-bb22' },
  { timestamp: '2026-03-12T14:23:07Z', service: 'order-service', level: 'info',
    message: 'Order ORD-2849 shipped via FedEx', traceId: 'tr-cc33' },
];

// ── Pipeline ────────────────────────────────────────────────────────────────

const chart = flowChart<SupportState>(
  'ReceiveTicket',
  async (scope) => {
    const { ticket } = scope.$getArgs<{ ticket: SupportTicket }>();
    scope.ticketId = ticket.ticketId;
    scope.customerEmail = ticket.customerEmail;
    scope.subject = ticket.subject;
    scope.body = ticket.body;
    scope.receivedAt = new Date().toISOString();
  },
  'receive-ticket',
  'Receive and parse the support ticket',
)
  .addFunction(
    'ClassifyTicket',
    async (scope) => {
      const text = `${scope.subject} ${scope.body}`.toLowerCase();
      await new Promise((r) => setTimeout(r, 30));

      let category = 'general';
      if (text.includes('charge') || text.includes('payment') ||
          text.includes('refund') || text.includes('billing')) {
        category = 'billing';
      } else if (text.includes('error') || text.includes('bug') ||
                 text.includes('crash') || text.includes('broken')) {
        category = 'technical';
      } else if (text.includes('shipping') || text.includes('delivery') ||
                 text.includes('tracking')) {
        category = 'shipping';
      }

      const urgent = text.includes('twice') || text.includes('overcharged') ||
        text.includes('fraud') || text.includes('unauthorized');
      scope.category = category;
      scope.priority = urgent ? 'P1' : category === 'billing' ? 'P2' : 'P3';
      scope.classificationConfidence = urgent ? 0.95 : 0.82;
      scope.urgentFlag = urgent;
    },
    'classify-ticket',
    'Classify ticket category and priority using keyword analysis',
  )
  .addFunction(
    'LookupCustomer',
    async (scope) => {
      await new Promise((r) => setTimeout(r, 20));

      scope.crmAttempt = 1;
      scope.$debug('crmLookup', 'First CRM request timed out after 3000ms');
      await new Promise((r) => setTimeout(r, 15));

      scope.crmAttempt = 2;
      const customer = customerDB[scope.customerEmail];
      if (!customer) {
        scope.customerFound = false;
        scope.customerName = 'Unknown';
        scope.customerTier = 'standard';
        return;
      }
      scope.customerFound = true;
      scope.customerName = customer.name;
      scope.customerTier = customer.tier;
      scope.accountAge = customer.accountAge;
      scope.totalOrders = customer.totalOrders;
      scope.openTickets = customer.openTickets;
      scope.paymentMethod = customer.paymentMethod;
    },
    'lookup-customer',
    'Look up customer profile in CRM database (with retry on timeout)',
  )
  .addFunction(
    'LookupOrder',
    async (scope) => {
      await new Promise((r) => setTimeout(r, 25));
      const orderMatch = scope.body.match(/ORD-\d+/);
      if (!orderMatch) {
        scope.orderFound = false;
        return;
      }
      const orderId = orderMatch[0];
      const order = orderDB[orderId];
      if (!order) {
        scope.orderFound = false;
        scope.extractedOrderId = orderId;
        return;
      }
      scope.orderFound = true;
      scope.orderId = order.orderId;
      scope.orderAmount = order.amount;
      scope.orderStatus = order.status;
      scope.orderItems = order.items;
      scope.paymentAttempts = order.paymentAttempts;

      const successfulCharges = order.paymentAttempts.filter((a) => a.status === 'success');
      scope.chargeCount = successfulCharges.length;
      scope.totalCharged = successfulCharges.reduce((s, a) => s + a.amount, 0);
      if (successfulCharges.length > 1) {
        scope.duplicateChargeDetected = true;
        scope.overchargeAmount = (successfulCharges.length - 1) * order.amount;
      }
    },
    'lookup-order',
    'Find the referenced order and check payment history for anomalies',
  )
  .addFunction(
    'SearchLogs',
    async (scope) => {
      await new Promise((r) => setTimeout(r, 35));
      scope.servicesSearched = 4;
      scope.totalLogsScanned = scatteredLogs.length;

      const authLog = scatteredLogs.find(
        (l) => l.service === 'auth-service' && l.message.includes(scope.customerEmail),
      );
      const traceId = authLog?.traceId;
      scope.correlatedTraceId = traceId ?? 'none';

      if (!traceId) {
        scope.relevantLogs = [];
        scope.relevantLogCount = 0;
        return;
      }

      const relevantLogs = scatteredLogs
        .filter((l) => l.traceId === traceId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      scope.relevantLogs = relevantLogs;
      scope.relevantLogCount = relevantLogs.length;

      const orderMatch = scope.body.match(/ORD-\d+/);
      if (orderMatch) {
        const orderLogs = relevantLogs.filter((l) => l.message.includes(orderMatch[0]));
        scope.orderRelatedLogCount = orderLogs.length;
      }
    },
    'search-logs',
    'Search scattered logs across 4 services and correlate by trace ID',
  )
  .addFunction(
    'BuildErrorChain',
    async (scope) => {
      await new Promise((r) => setTimeout(r, 20));
      const errors = scope.relevantLogs.filter(
        (l) => l.level === 'error' || l.level === 'warn',
      );
      scope.errorChain = errors.map((log) => `[${log.service}] ${log.message}`);
      scope.errorCount = errors.length;

      const hasTimeout = errors.some((e) => e.message.includes('timeout'));
      const hasDuplicate = errors.some((e) => e.message.includes('DUPLICATE'));

      if (hasTimeout && hasDuplicate) {
        scope.rootCause = 'Gateway timeout caused retry, resulting in duplicate charge';
        scope.rootCauseService = 'payment-service';
        scope.rootCauseType = 'gateway-timeout-duplicate';
      } else if (hasDuplicate) {
        scope.rootCause = 'Duplicate charge without clear timeout trigger';
        scope.rootCauseType = 'unknown-duplicate';
      } else {
        scope.rootCause = 'No clear error pattern identified';
        scope.rootCauseType = 'unknown';
      }
    },
    'build-error-chain',
    'Reconstruct the error chain and identify root cause from correlated logs',
  )
  .addFunction(
    'MergeFindings',
    async (scope) => {
      scope.findingSummary = {
        category: scope.category,
        priority: scope.priority,
        customerTier: scope.customerTier,
        duplicateCharge: !!scope.duplicateChargeDetected,
        rootCauseType: scope.rootCauseType,
        errorChainLength: scope.errorChain?.length ?? 0,
      };
    },
    'merge-findings',
    'Combine classification, customer context, and log analysis into unified findings',
  )
  .addDeciderFunction(
    'ResolutionDecision',
    (scope) => {
      return decide(
        scope,
        [
          {
            when: (s) =>
              !!s.duplicateChargeDetected &&
              s.rootCauseType === 'gateway-timeout-duplicate',
            then: 'auto-refund',
            label: 'Confirmed gateway-timeout duplicate',
          },
          {
            when: (s) => !!s.duplicateChargeDetected,
            then: 'escalate',
            label: 'Unconfirmed duplicate charge',
          },
        ],
        'manual-review',
      );
    },
    'resolution-decision',
    'Route to auto-refund, escalation, or manual review based on findings',
  )
    .addFunctionBranch(
      'auto-refund',
      'AutoRefund',
      async (scope) => {
        await new Promise((r) => setTimeout(r, 20));
        scope.refundAmount = scope.overchargeAmount;
        scope.refundStatus = 'processed';
        scope.resolution = `AUTO-REFUND: $${scope.overchargeAmount?.toFixed(2)} refunded to ${scope.customerName} for duplicate charge on ${scope.orderId}. Root cause: payment gateway timeout triggered retry resulting in double charge.`;
        scope.resolutionType = 'auto-refund';
      },
      'Process automatic refund for confirmed duplicate charge',
    )
    .addFunctionBranch(
      'escalate',
      'Escalate',
      async (scope) => {
        scope.escalatedTo = 'billing-team';
        scope.resolution = `ESCALATED: Ticket for ${scope.customerName} (${scope.orderId}) sent to billing team. Duplicate charge detected but root cause requires investigation.`;
        scope.resolutionType = 'escalate';
      },
      'Escalate to billing team for further investigation',
    )
    .addFunctionBranch(
      'manual-review',
      'ManualReview',
      async (scope) => {
        scope.assignedTo = 'support-agent-queue';
        scope.resolution = `MANUAL REVIEW: Ticket for ${scope.customerName} assigned to support agent queue. No automated resolution possible.`;
        scope.resolutionType = 'manual-review';
      },
      'Assign to support agent queue for manual review',
    )
    .setDefault('manual-review')
    .end()
  .build();

/** Build-time spec for visualization (equivalent to builder.toSpec()). */
export const flowchartSpec = chart.buildTimeStructure;

/** Default ticket pre-loaded in the demo UI. */
export const defaultTicket: SupportTicket = {
  ticketId: 'TKT-10042',
  customerEmail: 'jane.smith@example.com',
  subject: 'Charged twice for my order',
  body: 'I placed order ORD-2847 yesterday and I see two charges of $189.99 on my credit card statement. I should only have been charged once. Please refund the duplicate charge.',
  timestamp: '2026-03-13T09:15:00Z',
};

// ── Run function ────────────────────────────────────────────────────────────

export async function runSupportPipeline(ticket: SupportTicket): Promise<SupportResult> {
  const executor = new FlowChartExecutor(chart);
  executor.enableNarrative();
  await executor.run({ input: { ticket } });

  const narrative = executor.getNarrative() as string[];
  const narrativeEntries = executor.getNarrativeEntries();
  const runtimeSnapshot = executor.getSnapshot();
  const snapshot = runtimeSnapshot.sharedState as Record<string, unknown>;

  return {
    resolution: snapshot.resolution as string,
    resolutionType: snapshot.resolutionType as SupportResult['resolutionType'],
    category: snapshot.category as string,
    priority: snapshot.priority as string,
    customerName: snapshot.customerName as string,
    customerTier: snapshot.customerTier as string,
    orderAmount: snapshot.orderAmount as number,
    errorChain: (snapshot.errorChain as string[]) ?? [],
    logCount: snapshot.relevantLogCount as number,
    servicesSearched: snapshot.servicesSearched as number,
    narrative,
    narrativeEntries,
    snapshot,
    runtimeSnapshot,
  };
}
