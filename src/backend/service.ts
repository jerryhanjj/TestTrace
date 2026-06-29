import { generateLabels } from '../labels';
import { parseCUnit } from '../parsing/cunit';
import { detectFramework } from '../parsing/detect';
import { parseGTest } from '../parsing/gtest';
import { resolveScope } from '../scope';
import type {
  GenerateLabelsRequest,
  GenerateLabelsResponse,
  ParsePreviewRequest,
  ParsePreviewResponse,
  ParsedCase
} from '../types';
import { INTERNAL_PATH_MAPPINGS } from './internalPathMappings';

export async function buildParsePreview(request: ParsePreviewRequest): Promise<ParsePreviewResponse> {
  const detection = detectFramework(request.fullFileText, request.selectedText, request.frameworkHint);
  const framework = detection.framework ?? request.frameworkHint;
  if (!framework) {
    throw new Error('Unable to determine the test framework for the current input.');
  }

  let selectionMode = request.selectionMode;
  if (framework === 'cunit' && selectionMode === 'selection') {
    selectionMode = 'current_file';
  }

  const scope = resolveScope(request.sourceRelativePath, INTERNAL_PATH_MAPPINGS, true);
  const parsedCases = framework === 'gtest'
    ? parseGTest(request.fullFileText, request.fileName, request.sourceRelativePath)
    : parseCUnit(request.fullFileText, request.fileName, request.sourceRelativePath);

  let cases = parsedCases;
  const warnings = [...detection.warnings, ...scope.warnings];
  if (selectionMode === 'selection') {
    cases = parsedCases.filter((item) => overlaps(item.startOffset, item.endOffset, request.selectionStart, request.selectionEnd));
    if (cases.length === 0) {
      throw new Error('The current selection does not overlap a full gtest case. Expand the selection or use current-file parsing.');
    }
    warnings.push('selection_filtered_cases');
  }

  if (cases.length === 0) {
    throw new Error(`No ${framework} test cases were detected in the current input.`);
  }

  return {
    framework,
    team: scope.team ? { ...scope.team, source: 'service' } : undefined,
    component: scope.component ? { ...scope.component, source: 'service' } : undefined,
    warnings,
    cases
  };
}

export async function buildGenerateLabels(
  request: GenerateLabelsRequest
): Promise<GenerateLabelsResponse> {
  return generateLabels(
    {
      sourceRelativePath: request.sourceRelativePath,
      fileName: request.fileName,
      framework: request.framework,
      cases: request.cases as ParsedCase[]
    },
    request.selectedIds,
    request.team,
    request.component
  );
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA <= endB && startB <= endA;
}