import type { GenerateLabelsResponse, LabelResult, ParsedCase } from './types';
import { buildCaseHash, buildContentHash, buildLabel } from './utils';

export async function generateLabels(
  review: {
    sourceRelativePath: string;
    fileName: string;
    framework: ParsedCase['framework'];
    cases: ParsedCase[];
  },
  selectedIds: string[],
  team: string,
  component: string
): Promise<GenerateLabelsResponse> {
  const results: LabelResult[] = [];

  for (const parsedCase of review.cases.filter((item) => selectedIds.includes(item.id))) {
    const caseHash = buildCaseHash({
      fileName: review.fileName,
      framework: review.framework,
      suiteName: parsedCase.suiteName,
      caseName: parsedCase.caseName
    });
    const contentHash = buildContentHash({
      framework: review.framework,
      caseName: parsedCase.caseName,
      normalizedTestCode: parsedCase.normalizedTestCode
    });

    const label = buildLabel({
      team,
      component,
      caseHash16B: caseHash.short16B,
      contentHash16B: contentHash.short16B
    });

    results.push({
      suiteName: parsedCase.suiteName,
      caseName: parsedCase.caseName,
      caseHashFull: caseHash.full,
      caseHash16B: caseHash.short16B,
      contentHashFull: contentHash.full,
      contentHash16B: contentHash.short16B,
      label,
      isDuplicate: false,
      isNewRevision: false,
      conflictStatus: 'none',
      conflictReason: ''
    });
  }

  return {
    team,
    component,
    results,
    warnings: [],
    conflicts: []
  };
}
