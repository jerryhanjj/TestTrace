import { findBalanced, findNextNonSpace, maskSource, splitTopLevelArgs } from './core';
import type { ParsedCase } from '../types';
import { normalizeCode, normalizeTitle } from '../utils';

const GTEST_PATTERN = /\b(?:TEST|TEST_F|TEST_P|TYPED_TEST|TYPED_TEST_P)\s*\(/g;

export function parseGTest(text: string, fileName: string, sourceRelativePath: string): ParsedCase[] {
  const { originalText, maskedText, lineIndex } = maskSource(text);
  const cases: ParsedCase[] = [];

  for (const match of originalText.matchAll(GTEST_PATTERN)) {
    const macroStart = match.index ?? 0;
    const openParen = macroStart + match[0].lastIndexOf('(');
    const closeParen = findBalanced(maskedText, openParen, '(', ')');
    if (closeParen < 0) {
      continue;
    }

    const rawArgs = originalText.slice(openParen + 1, closeParen);
    const args = splitTopLevelArgs(rawArgs);
    if (args.length !== 2) {
      continue;
    }

    const suiteName = normalizeTitle(args[0]);
    const caseName = normalizeTitle(args[1]);
    const bodyStart = findNextNonSpace(maskedText, closeParen + 1);
    if (bodyStart < 0 || maskedText[bodyStart] !== '{') {
      continue;
    }

    const bodyClose = findBalanced(maskedText, bodyStart, '{', '}');
    const snippetEnd = bodyClose >= 0 ? bodyClose + 1 : closeParen + 1;
    const snippet = originalText.slice(macroStart, snippetEnd);
    const warnings = bodyClose >= 0 ? [] : ['body_not_closed'];
    const confidence = bodyClose >= 0 ? 95 : 60;

    cases.push({
      id: `${suiteName}:${caseName}:${macroStart}`,
      framework: 'gtest',
      fileName,
      sourceRelativePath,
      suiteName,
      caseName,
      displayName: caseName,
      sourceSnippet: snippet,
      normalizedTestCode: normalizeCode(snippet),
      lineStart: lineIndex.lineOf(macroStart),
      lineEnd: lineIndex.lineOf(snippetEnd),
      parseConfidence: confidence,
      parseStrategy: 'gtest_macro_block',
      warnings,
      startOffset: macroStart,
      endOffset: snippetEnd
    });
  }

  return cases;
}