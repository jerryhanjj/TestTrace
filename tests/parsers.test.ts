import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCUnit } from '../src/parsing/cunit';
import { parseGTest } from '../src/parsing/gtest';
import { cunitFixture, cunitRegistrationOnlyFixture } from './fixtures/cunit-fixture';
import { gtestFixture } from './fixtures/gtest-fixture';

test('parseGTest extracts TEST and TEST_F cases from the fixture', () => {
  const cases = parseGTest(gtestFixture, 'refund_test.cpp', 'components/payment/tests/refund_test.cpp');

  assert.equal(cases.length, 2);
  assert.deepEqual(
    cases.map((item) => [item.suiteName, item.caseName]),
    [
      ['MathUtilTest', 'HandlesOverflow'],
      ['RefundServiceTest', 'RejectsNegativeAmount']
    ]
  );
  assert.equal(cases[0].parseStrategy, 'gtest_macro_block');
  assert.equal(cases[0].parseConfidence, 95);
  assert.match(cases[0].sourceSnippet, /brace in string/);
  assert.ok(cases[1].normalizedTestCode.includes('EXPECT_FALSE(service.Apply(-1));'));
});

test('parseCUnit links suite registration, test registration, and function definitions', () => {
  const cases = parseCUnit(cunitFixture, 'refund_cunit.c', 'components/payment/tests/refund_cunit.c');

  assert.equal(cases.length, 2);
  assert.deepEqual(
    cases.map((item) => [item.suiteName, item.caseName, item.displayName]),
    [
      ['RefundSuite', 'test_negative_amount', 'negative amount'],
      ['RefundSuite', 'test_zero_amount', 'zero amount']
    ]
  );
  assert.equal(cases[0].parseStrategy, 'cunit_registration_plus_function');
  assert.equal(cases[0].parseConfidence, 95);
  assert.match(cases[0].sourceSnippet, /void test_negative_amount\(void\)/);
});

test('parseCUnit degrades to registration-only mode when a test function body is missing', () => {
  const cases = parseCUnit(
    cunitRegistrationOnlyFixture,
    'refund_cunit.c',
    'components/payment/tests/refund_cunit.c'
  );

  assert.equal(cases.length, 1);
  assert.equal(cases[0].parseStrategy, 'cunit_registration_only');
  assert.equal(cases[0].parseConfidence, 65);
  assert.ok(cases[0].warnings.includes('function_definition_not_found'));
  assert.match(cases[0].sourceSnippet, /CU_add_test/);
});