/**
 * Feature: setValue / getValue
 *
 * Demonstrates storing and reading values in scope:
 * - Primitives (string, number, boolean)
 * - Objects and nested objects
 * - Arrays
 *
 * Run:  npm run feature:values
 */

import { flowChart, FlowChartExecutor, ScopeFacade } from 'footprint';
// Note: scopeFactory is optional — FlowChartExecutor defaults to ScopeFacade

(async () => {

const chart = flowChart('SetValues', async (scope: ScopeFacade) => {
  // Primitives
  scope.setValue('name', 'Alice');
  scope.setValue('age', 30);
  scope.setValue('active', true);

  // Object — setValue accepts any type
  scope.setValue('profile', {
    email: 'alice@example.com',
    address: { city: 'Portland', state: 'OR' },
  });

  // Array
  scope.setValue('tags', ['admin', 'verified']);
})
  .addFunction('ReadValues', async (scope: ScopeFacade) => {
    const name = scope.getValue('name');
    const age = scope.getValue('age');
    const active = scope.getValue('active');
    const profile = scope.getValue('profile') as any;
    const tags = scope.getValue('tags') as string[];

    console.log('Primitives:', { name, age, active });
    console.log('Object:', profile);
    console.log('Nested:', profile.address.city);
    console.log('Array:', tags);
  })
  .build();

const executor = new FlowChartExecutor(chart);
await executor.run();

console.log('\nAll value types work with setValue/getValue.');
})().catch(console.error);
