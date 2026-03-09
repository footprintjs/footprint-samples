/**
 * Feature: Contract & OpenAPI
 *
 * Demonstrates defining I/O contracts on flowcharts and generating
 * OpenAPI 3.1 specs. Supports both Zod schemas and raw JSON Schema.
 *
 * - defineContract() wraps a FlowChart with input/output schemas
 * - contract.toOpenAPI() generates a full OpenAPI spec
 * - Zod schemas auto-convert to JSON Schema
 * - Raw JSON Schema works too (no Zod dependency required)
 *
 * Run:  npm run feature:contract
 */

import { flowChart, FlowChartExecutor, ScopeFacade, defineContract } from 'footprint';
import { z } from 'zod';

(async () => {
  // ── Stage functions ─────────────────────────────────────────────────────

  const receiveOrder = async (scope: ScopeFacade) => {
    // In a real app, input comes from readOnlyContext
    scope.setValue('item', 'Widget Pro');
    scope.setValue('quantity', 3);
    scope.setValue('unitPrice', 29.99);
  };

  const calculateTotal = async (scope: ScopeFacade) => {
    const qty = scope.getValue('quantity') as number;
    const price = scope.getValue('unitPrice') as number;
    const subtotal = qty * price;
    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    scope.setValue('subtotal', subtotal);
    scope.setValue('tax', tax);
    scope.setValue('total', subtotal + tax);
  };

  const classifyOrder = (scope: ScopeFacade): string => {
    const total = scope.getValue('total') as number;
    return total > 100 ? 'large' : 'small';
  };

  const processLarge = async (scope: ScopeFacade) => {
    scope.setValue('shippingMethod', 'express');
    scope.setValue('status', 'approved — large order, express shipping');
  };

  const processSmall = async (scope: ScopeFacade) => {
    scope.setValue('shippingMethod', 'standard');
    scope.setValue('status', 'approved — standard shipping');
  };

  // ── Build the flowchart ─────────────────────────────────────────────────

  const chart = flowChart('ReceiveOrder', receiveOrder)
    .setEnableNarrative()
    .addFunction('CalculateTotal', calculateTotal)
    .addDeciderFunction('ClassifyOrder', classifyOrder as any)
      .addFunctionBranch('large', 'ProcessLargeOrder', processLarge)
      .addFunctionBranch('small', 'ProcessSmallOrder', processSmall)
      .setDefault('small')
      .end()
    .build();

  // ── Define contract with Zod schemas ────────────────────────────────────

  console.log('=== Contract with Zod Schemas ===\n');

  const contract = defineContract(chart, {
    inputSchema: z.object({
      item: z.string().describe('Product name'),
      quantity: z.number().describe('Number of units'),
      unitPrice: z.number().describe('Price per unit in USD'),
    }),
    outputSchema: z.object({
      total: z.number().describe('Order total including tax'),
      shippingMethod: z.enum(['standard', 'express']),
      status: z.string(),
    }),
    outputMapper: (scope) => ({
      total: scope.total as number,
      shippingMethod: scope.shippingMethod as string,
      status: scope.status as string,
    }),
  });

  console.log('Input schema (JSON Schema):');
  console.log(JSON.stringify(contract.inputSchema, null, 2));

  console.log('\nOutput schema (JSON Schema):');
  console.log(JSON.stringify(contract.outputSchema, null, 2));

  // ── Generate OpenAPI spec ───────────────────────────────────────────────

  console.log('\n=== OpenAPI 3.1 Spec ===\n');

  const spec = contract.toOpenAPI({
    version: '1.0.0',
    basePath: '/api/v1',
  });

  console.log(JSON.stringify(spec, null, 2));

  // ── Run the pipeline ────────────────────────────────────────────────────

  console.log('\n=== Pipeline Execution ===\n');

  const executor = new FlowChartExecutor(chart);
  await executor.run();

  const narrative = executor.getNarrative();
  console.log('Narrative:');
  console.log(narrative);

  // Apply the output mapper to the final shared state
  const snapshot = executor.getSnapshot();
  const output = contract.outputMapper?.(snapshot.sharedState || {});
  console.log('\nMapped output:');
  console.log(JSON.stringify(output, null, 2));

  // ── Raw JSON Schema (no Zod) ────────────────────────────────────────────

  console.log('\n=== Contract with Raw JSON Schema (no Zod needed) ===\n');

  const rawContract = defineContract(chart, {
    inputSchema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'Product name' },
        quantity: { type: 'number', description: 'Number of units' },
      },
      required: ['item', 'quantity'],
    },
  });

  console.log('Input schema (passed through as-is):');
  console.log(JSON.stringify(rawContract.inputSchema, null, 2));

  const rawSpec = rawContract.toOpenAPI();
  console.log('\nOpenAPI paths:');
  console.log(JSON.stringify(Object.keys(rawSpec.paths), null, 2));
})().catch(console.error);
