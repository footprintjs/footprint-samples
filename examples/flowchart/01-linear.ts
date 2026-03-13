/**
 * Flowchart: Linear Pipeline
 *
 * The simplest flow — stages execute one after another.
 *
 *   FetchUser → EnrichProfile → SendWelcomeEmail
 *
 * In the playground, edit the INPUT panel to change the user data.
 * Try it: https://footprintjs.github.io/footprint-playground/samples/linear
 */

import { flowChart, FlowChartExecutor, ScopeFacade } from 'footprint';

(async () => {

// ── Input ───────────────────────────────────────────────────────────────
// INPUT is provided via the playground's JSON input panel.
// When running standalone, fall back to default values.

const input: { userId: number } =
  (typeof INPUT !== 'undefined' && INPUT) || { userId: 42 };

// ── Mock Database ───────────────────────────────────────────────────────

const userDB = new Map([
  [42, { username: 'alice', email: 'alice@example.com', joinedAt: '2024-01-15' }],
  [99, { username: 'bob', email: 'bob@example.com', joinedAt: '2025-06-01' }],
]);

const emailLog: string[] = [];

// ── Stage Functions ─────────────────────────────────────────────────────

const fetchUser = async (scope: ScopeFacade) => {
  const { userId } = scope.getArgs<{ userId: number }>();
  const user = userDB.get(userId);
  if (!user) throw new Error(`User #${userId} not found`);
  scope.setValue('user', user);
};

const enrichProfile = async (scope: ScopeFacade) => {
  const user = scope.getValue('user') as any;
  const displayName = user.username.charAt(0).toUpperCase() + user.username.slice(1);
  const daysSinceJoin = Math.floor(
    (Date.now() - new Date(user.joinedAt).getTime()) / 86_400_000,
  );
  scope.setValue('displayName', displayName);
  scope.setValue('memberDays', daysSinceJoin);
  scope.setValue('tier', daysSinceJoin > 365 ? 'veteran' : 'newcomer');
};

const sendWelcomeEmail = async (scope: ScopeFacade) => {
  const displayName = scope.getValue('displayName') as string;
  const tier = scope.getValue('tier') as string;
  const user = scope.getValue('user') as any;

  const message =
    tier === 'veteran'
      ? `Welcome back, ${displayName}! Thanks for being a loyal member.`
      : `Welcome, ${displayName}! We're glad you're here.`;

  emailLog.push(`→ ${user.email}: ${message}`);
  scope.setValue('emailSent', true);
  scope.setValue('greeting', message);
};

// ── Flowchart ───────────────────────────────────────────────────────────

const chart = flowChart('FetchUser', fetchUser, 'fetch-user')
  .setEnableNarrative()
  .addFunction('EnrichProfile', enrichProfile, 'enrich-profile')
  .addFunction('SendWelcomeEmail', sendWelcomeEmail, 'send-welcome-email')
  .build();

// ── Run ─────────────────────────────────────────────────────────────────

const executor = new FlowChartExecutor(chart);
await executor.run({ input });

console.log('=== Linear Pipeline ===\n');
executor.getNarrative().forEach((line) => console.log(`  ${line}`));
console.log('\n--- Email Log ---');
emailLog.forEach((line) => console.log(`  ${line}`));
})().catch(console.error);
