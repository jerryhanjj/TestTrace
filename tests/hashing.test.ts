import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCaseHash, buildContentHash, normalizeCode } from '../src/utils';

test('buildCaseHash is stable across surrounding whitespace in identity fields', () => {
  const left = buildCaseHash({
    fileName: 'refund_test.cpp',
    framework: 'gtest',
    suiteName: 'RefundServiceTest',
    caseName: 'RejectsNegativeAmount'
  });

  const right = buildCaseHash({
    fileName: 'refund_test.cpp ',
    framework: 'gtest',
    suiteName: '  RefundServiceTest',
    caseName: 'RejectsNegativeAmount  '
  });

  assert.equal(left.full, right.full);
  assert.equal(left.short16B.length, 32);
});

test('buildContentHash is stable across BOM, CRLF, and trailing-space differences', () => {
  const unixCode = normalizeCode(`TEST_F(RefundServiceTest, RejectsNegativeAmount) {\n  EXPECT_FALSE(service.Apply(-1));\n}`);
  const windowsCode = normalizeCode(`\uFEFFTEST_F(RefundServiceTest, RejectsNegativeAmount) {\r\n  EXPECT_FALSE(service.Apply(-1));   \r\n}\r\n`);

  const left = buildContentHash({
    framework: 'gtest',
    caseName: 'RejectsNegativeAmount',
    normalizedTestCode: unixCode
  });

  const right = buildContentHash({
    framework: 'gtest',
    caseName: 'RejectsNegativeAmount',
    normalizedTestCode: windowsCode
  });

  assert.equal(left.full, right.full);
  assert.equal(left.short16B.length, 32);
});