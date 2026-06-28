import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveScope } from '../src/scope';

test('resolveScope chooses the longest matching path prefix', () => {
  const result = resolveScope(
    'components/payment/tests/refund_test.cpp',
    [
      {
        pattern: 'components/',
        team: 'PLATFORM',
        component: 'COMMON',
        priority: 1
      },
      {
        pattern: 'components/payment/',
        team: 'TRADE',
        component: 'PAYMENT',
        priority: 1
      }
    ],
    true
  );

  assert.equal(result.team?.code, 'TRADE');
  assert.equal(result.component?.code, 'PAYMENT');
  assert.deepEqual(result.warnings, []);
});

test('resolveScope returns a warning when no mapping rule matches', () => {
  const result = resolveScope('components/unknown/tests/demo.cpp', [], true);

  assert.equal(result.team, undefined);
  assert.equal(result.component, undefined);
  assert.ok(result.warnings.includes('scope_not_detected'));
});