/**
 * Integration test: Linear Pipeline (flowchart/01-linear)
 *
 * Verifies that a simple 3-stage linear pipeline produces the expected
 * narrative trace. Uses a fixed system time so memberDays is deterministic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flowChart, FlowChartExecutor } from 'footprint';

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

describe('Linear Pipeline — flowchart/01-linear', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });
  afterEach(() => vi.useRealTimers());

  it('narrative matches snapshot for userId=42 (alice, veteran member)', async () => {

    interface UserState {
      user: { username: string; email: string; joinedAt: string };
      displayName: string;
      memberDays: number;
      tier: string;
      emailSent: boolean;
      greeting: string;
    }

    const userDB = new Map([
      [42, { username: 'alice', email: 'alice@example.com', joinedAt: '2024-01-15' }],
    ]);

    const chart = flowChart<UserState>('FetchUser', async (scope) => {
      const { userId } = scope.$getArgs<{ userId: number }>();
      const user = userDB.get(userId);
      if (!user) throw new Error(`User #${userId} not found`);
      scope.user = user;
    }, 'fetch-user')
      .addFunction('EnrichProfile', async (scope) => {
        const displayName =
          scope.user.username.charAt(0).toUpperCase() + scope.user.username.slice(1);
        const daysSinceJoin = Math.floor(
          (Date.now() - new Date(scope.user.joinedAt).getTime()) / 86_400_000,
        );
        scope.displayName = displayName;
        scope.memberDays = daysSinceJoin;
        scope.tier = daysSinceJoin > 365 ? 'veteran' : 'newcomer';
      }, 'enrich-profile')
      .addFunction('SendWelcomeEmail', async (scope) => {
        const message =
          scope.tier === 'veteran'
            ? `Welcome back, ${scope.displayName}! Thanks for being a loyal member.`
            : `Welcome, ${scope.displayName}! We're glad you're here.`;
        scope.emailSent = true;
        scope.greeting = message;
      }, 'send-welcome-email')
      .build();

    const executor = new FlowChartExecutor(chart);
    executor.enableNarrative();
    await executor.run({ input: { userId: 42 } });

    const narrative = executor.getNarrative();
    expect(narrative).toMatchSnapshot();
    // Key behavioural assertions independent of exact narrative wording
    expect(narrative.some(l => l.includes('veteran'))).toBe(true);
    expect(narrative.some(l => l.includes('emailSent'))).toBe(true);
  });

  it('tier is "newcomer" for a recently joined user', async () => {
    vi.setSystemTime(FIXED_DATE);

    interface UserState {
      user: { username: string; email: string; joinedAt: string };
      displayName: string;
      memberDays: number;
      tier: string;
      emailSent: boolean;
      greeting: string;
    }

    const userDB = new Map([
      [99, { username: 'bob', email: 'bob@example.com', joinedAt: '2025-12-01' }],
    ]);

    const chart = flowChart<UserState>('FetchUser', async (scope) => {
      const { userId } = scope.$getArgs<{ userId: number }>();
      const user = userDB.get(userId);
      if (!user) throw new Error(`User #${userId} not found`);
      scope.user = user;
    }, 'fetch-user')
      .addFunction('EnrichProfile', async (scope) => {
        const daysSinceJoin = Math.floor(
          (Date.now() - new Date(scope.user.joinedAt).getTime()) / 86_400_000,
        );
        scope.displayName = scope.user.username;
        scope.memberDays = daysSinceJoin;
        scope.tier = daysSinceJoin > 365 ? 'veteran' : 'newcomer';
      }, 'enrich-profile')
      .addFunction('SendWelcomeEmail', async (scope) => {
        scope.emailSent = true;
        scope.greeting = `Welcome, ${scope.displayName}!`;
      }, 'send-welcome-email')
      .build();

    const executor = new FlowChartExecutor(chart);
    executor.enableNarrative();
    await executor.run({ input: { userId: 99 } });

    const narrative = executor.getNarrative();
    expect(narrative.some(l => l.includes('newcomer'))).toBe(true);
  });
});
