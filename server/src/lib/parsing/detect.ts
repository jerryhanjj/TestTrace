import type { Framework } from '../types';

export interface DetectionResult {
  framework?: Framework;
  confidence: number;
  warnings: string[];
}

export function detectFramework(fullFileText: string, selectedText?: string, hint?: Framework): DetectionResult {
  const source = selectedText?.trim().length ? selectedText : fullFileText;
  const gtestCount = (source.match(/\b(?:TEST|TEST_F|TEST_P|TYPED_TEST|TYPED_TEST_P)\s*\(/g) ?? []).length;
  const cunitCount = (source.match(/\b(?:CU_add_suite|CU_add_test)\s*\(/g) ?? []).length;

  if (hint) {
    if ((hint === 'gtest' && gtestCount >= cunitCount) || (hint === 'cunit' && cunitCount >= gtestCount)) {
      return { framework: hint, confidence: 90, warnings: [] };
    }
  }

  if (gtestCount > 0 && cunitCount === 0) {
    return { framework: 'gtest', confidence: 90, warnings: [] };
  }
  if (cunitCount > 0 && gtestCount === 0) {
    return { framework: 'cunit', confidence: 90, warnings: [] };
  }
  if (gtestCount > 0 && cunitCount > 0) {
    return { framework: undefined, confidence: 40, warnings: ['multiple_framework_markers_detected'] };
  }
  return { framework: hint, confidence: hint ? 50 : 0, warnings: ['framework_not_detected'] };
}