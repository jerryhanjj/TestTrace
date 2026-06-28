import { extractCStringLiteral, findBalanced, findNextNonSpace, maskSource, splitTopLevelArgs } from './core';
import type { ParsedCase } from '../types';
import { escapeRegExp, normalizeCode, normalizeTitle, normalizeToken } from '../utils';

interface SuiteBinding {
  suiteVar: string;
  suiteName: string;
}

interface PendingCase {
  suiteName: string;
  caseName: string;
  displayName: string;
  registrationStart: number;
  registrationEnd: number;
  warnings: string[];
}

interface FunctionDefinition {
  snippet: string;
  startOffset: number;
  endOffset: number;
  lineStart: number;
  lineEnd: number;
}

const SUITE_PATTERN = /\bCU_add_suite\s*\(/g;
const TEST_PATTERN = /\bCU_add_test\s*\(/g;

export function parseCUnit(text: string, fileName: string, sourceRelativePath: string): ParsedCase[] {
  const { originalText, maskedText, lineIndex } = maskSource(text);
  const suites = parseSuites(originalText, maskedText);
  const pendingCases = parseRegistrations(originalText, maskedText, suites);

  return pendingCases.map((pending) => {
    const definition = findFunctionDefinition(originalText, maskedText, pending.caseName, lineIndex);
    const snippet = definition?.snippet ?? originalText.slice(pending.registrationStart, pending.registrationEnd);
    const parseStrategy = definition ? 'cunit_registration_plus_function' : 'cunit_registration_only';
    const warnings = [...pending.warnings];
    if (!definition) {
      warnings.push('function_definition_not_found');
    }
    return {
      id: `${pending.suiteName}:${pending.caseName}:${pending.registrationStart}`,
      framework: 'cunit',
      fileName,
      sourceRelativePath,
      suiteName: pending.suiteName,
      caseName: pending.caseName,
      displayName: pending.displayName,
      sourceSnippet: snippet,
      normalizedTestCode: normalizeCode(snippet),
      lineStart: definition?.lineStart ?? lineIndex.lineOf(pending.registrationStart),
      lineEnd: definition?.lineEnd ?? lineIndex.lineOf(pending.registrationEnd),
      parseConfidence: definition ? 95 : 65,
      parseStrategy,
      warnings,
      startOffset: definition?.startOffset ?? pending.registrationStart,
      endOffset: definition?.endOffset ?? pending.registrationEnd
    } satisfies ParsedCase;
  });
}

function parseSuites(originalText: string, maskedText: string): Map<string, SuiteBinding> {
  const suites = new Map<string, SuiteBinding>();
  for (const match of originalText.matchAll(SUITE_PATTERN)) {
    const callStart = match.index ?? 0;
    const openParen = callStart + match[0].lastIndexOf('(');
    const closeParen = findBalanced(maskedText, openParen, '(', ')');
    if (closeParen < 0) {
      continue;
    }
    const args = splitTopLevelArgs(originalText.slice(openParen + 1, closeParen));
    if (args.length < 1) {
      continue;
    }
    const suiteName = extractCStringLiteral(args[0]) ?? normalizeTitle(args[0]);
    const suiteVar = findAssignmentTarget(originalText, callStart);
    if (!suiteVar) {
      continue;
    }
    suites.set(suiteVar, {
      suiteVar,
      suiteName
    });
  }
  return suites;
}

function parseRegistrations(originalText: string, maskedText: string, suites: Map<string, SuiteBinding>): PendingCase[] {
  const pendingCases: PendingCase[] = [];
  for (const match of originalText.matchAll(TEST_PATTERN)) {
    const callStart = match.index ?? 0;
    const openParen = callStart + match[0].lastIndexOf('(');
    const closeParen = findBalanced(maskedText, openParen, '(', ')');
    if (closeParen < 0) {
      continue;
    }
    const args = splitTopLevelArgs(originalText.slice(openParen + 1, closeParen));
    if (args.length !== 3) {
      continue;
    }
    const suiteRef = normalizeToken(args[0]);
    const displayName = extractCStringLiteral(args[1]) ?? normalizeTitle(args[1]);
    const caseName = normalizeToken(args[2]);
    const suiteName = suites.get(suiteRef)?.suiteName ?? '';
    const warnings: string[] = [];
    if (!suiteName) {
      warnings.push('suite_binding_not_found');
    }
    pendingCases.push({
      suiteName,
      caseName,
      displayName,
      registrationStart: callStart,
      registrationEnd: closeParen + 1,
      warnings
    });
  }
  return pendingCases;
}

function findAssignmentTarget(text: string, callStart: number): string | undefined {
  let boundary = callStart;
  while (boundary > 0) {
    const previous = text[boundary - 1];
    if (previous === ';' || previous === '{' || previous === '}' || previous === '\n') {
      break;
    }
    boundary -= 1;
  }
  const prefix = text.slice(boundary, callStart);
  const match = prefix.match(/([A-Za-z_]\w*)\s*=\s*$/);
  return match?.[1];
}

function findFunctionDefinition(
  originalText: string,
  maskedText: string,
  caseName: string,
  lineIndex: ReturnType<typeof maskSource>['lineIndex']
): FunctionDefinition | null {
  const pattern = new RegExp(`\\b${escapeRegExp(caseName)}\\s*\\(`, 'g');
  for (const match of maskedText.matchAll(pattern)) {
    const nameOffset = match.index ?? 0;
    const openParen = maskedText.indexOf('(', nameOffset);
    if (openParen < 0) {
      continue;
    }
    const closeParen = findBalanced(maskedText, openParen, '(', ')');
    if (closeParen < 0) {
      continue;
    }
    const bodyStart = findNextNonSpace(maskedText, closeParen + 1);
    if (bodyStart < 0 || maskedText[bodyStart] !== '{') {
      continue;
    }
    const bodyClose = findBalanced(maskedText, bodyStart, '{', '}');
    if (bodyClose < 0) {
      continue;
    }
    const signatureStart = findFunctionSignatureStart(originalText, nameOffset);
    return {
      snippet: originalText.slice(signatureStart, bodyClose + 1),
      startOffset: signatureStart,
      endOffset: bodyClose + 1,
      lineStart: lineIndex.lineOf(signatureStart),
      lineEnd: lineIndex.lineOf(bodyClose + 1)
    };
  }
  return null;
}

function findFunctionSignatureStart(text: string, nameOffset: number): number {
  let currentLineStart = findLineStart(text, nameOffset);
  let signatureStart = currentLineStart;

  while (currentLineStart > 0) {
    const previousLineEnd = currentLineStart - 1;
    const previousLineStart = findLineStart(text, previousLineEnd);
    const previousLine = text.slice(previousLineStart, previousLineEnd).trim();
    if (!previousLine || previousLine.endsWith(';') || previousLine.endsWith('}') || previousLine.startsWith('#')) {
      break;
    }
    signatureStart = previousLineStart;
    currentLineStart = previousLineStart;
  }

  return signatureStart;
}

function findLineStart(text: string, offset: number): number {
  let cursor = offset;
  while (cursor > 0 && text[cursor - 1] !== '\n') {
    cursor -= 1;
  }
  return cursor;
}