import { normalizeCode, normalizeTitle } from '../utils';

export interface LineIndex {
  lineOf(offset: number): number;
}

export interface MaskResult {
  originalText: string;
  maskedText: string;
  lineIndex: LineIndex;
}

type Mode = 'code' | 'line_comment' | 'block_comment' | 'string_double' | 'char_literal' | 'raw_string';

export function buildLineIndex(text: string): LineIndex {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      starts.push(index + 1);
    }
  }
  return {
    lineOf(offset: number): number {
      let low = 0;
      let high = starts.length - 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (starts[mid] <= offset) {
          if (mid === starts.length - 1 || starts[mid + 1] > offset) {
            return mid + 1;
          }
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return 1;
    }
  };
}

function startsRawString(text: string, index: number): { delimiter: string; start: number; end: number } | undefined {
  if (text[index] !== 'R' || text[index + 1] !== '"') {
    return undefined;
  }
  const delimiterStart = index + 2;
  const openParen = text.indexOf('(', delimiterStart);
  if (openParen < 0) {
    return undefined;
  }
  const delimiter = text.slice(delimiterStart, openParen);
  if (/\s/.test(delimiter)) {
    return undefined;
  }
  return { delimiter, start: index, end: openParen };
}

export function maskSource(text: string): MaskResult {
  const source = normalizeCode(text);
  const lineIndex = buildLineIndex(source);
  const output = source.split('');
  let mode: Mode = 'code';
  let rawStringEnd = '';

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (mode === 'code') {
      const rawMatch = startsRawString(source, index);
      if (rawMatch) {
        for (let cursor = rawMatch.start; cursor <= rawMatch.end; cursor += 1) {
          output[cursor] = source[cursor] === '\n' ? '\n' : ' ';
        }
        index = rawMatch.end;
        mode = 'raw_string';
        rawStringEnd = `)${rawMatch.delimiter}\"`;
        continue;
      }
      if (current === '/' && next === '/') {
        output[index] = ' ';
        output[index + 1] = ' ';
        index += 1;
        mode = 'line_comment';
        continue;
      }
      if (current === '/' && next === '*') {
        output[index] = ' ';
        output[index + 1] = ' ';
        index += 1;
        mode = 'block_comment';
        continue;
      }
      if (current === '"') {
        output[index] = ' ';
        mode = 'string_double';
        continue;
      }
      if (current === '\'') {
        output[index] = ' ';
        mode = 'char_literal';
        continue;
      }
      continue;
    }

    if (mode === 'line_comment') {
      output[index] = current === '\n' ? '\n' : ' ';
      if (current === '\n') {
        mode = 'code';
      }
      continue;
    }

    if (mode === 'block_comment') {
      if (current === '*' && next === '/') {
        output[index] = ' ';
        output[index + 1] = ' ';
        index += 1;
        mode = 'code';
        continue;
      }
      output[index] = current === '\n' ? '\n' : ' ';
      continue;
    }

    if (mode === 'string_double' || mode === 'char_literal') {
      if (current === '\\') {
        output[index] = ' ';
        if (index + 1 < output.length) {
          output[index + 1] = source[index + 1] === '\n' ? '\n' : ' ';
          index += 1;
        }
        continue;
      }
      if ((mode === 'string_double' && current === '"') || (mode === 'char_literal' && current === '\'')) {
        output[index] = ' ';
        mode = 'code';
        continue;
      }
      output[index] = current === '\n' ? '\n' : ' ';
      continue;
    }

    if (mode === 'raw_string') {
      if (source.startsWith(rawStringEnd, index)) {
        for (let cursor = 0; cursor < rawStringEnd.length; cursor += 1) {
          output[index + cursor] = source[index + cursor] === '\n' ? '\n' : ' ';
        }
        index += rawStringEnd.length - 1;
        rawStringEnd = '';
        mode = 'code';
        continue;
      }
      output[index] = current === '\n' ? '\n' : ' ';
    }
  }

  return {
    originalText: source,
    maskedText: output.join(''),
    lineIndex
  };
}

export function findBalanced(maskedText: string, openIndex: number, openChar: '(' | '{', closeChar: ')' | '}'): number {
  let depth = 0;
  for (let index = openIndex; index < maskedText.length; index += 1) {
    const current = maskedText[index];
    if (current === openChar) {
      depth += 1;
    } else if (current === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

export function findNextNonSpace(maskedText: string, start: number): number {
  for (let index = start; index < maskedText.length; index += 1) {
    if (!/\s/.test(maskedText[index])) {
      return index;
    }
  }
  return -1;
}

export function splitTopLevelArgs(rawArgs: string): string[] {
  const result: string[] = [];
  let current = '';
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let angleDepth = 0;
  let stringMode: 'double' | 'single' | undefined;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const char = rawArgs[index];
    const next = rawArgs[index + 1];

    if (stringMode) {
      current += char;
      if (char === '\\' && next) {
        current += next;
        index += 1;
        continue;
      }
      if ((stringMode === 'double' && char === '"') || (stringMode === 'single' && char === '\'')) {
        stringMode = undefined;
      }
      continue;
    }

    if (char === '"') {
      stringMode = 'double';
      current += char;
      continue;
    }
    if (char === '\'') {
      stringMode = 'single';
      current += char;
      continue;
    }

    if (char === '(') {
      parenDepth += 1;
      current += char;
      continue;
    }
    if (char === ')') {
      parenDepth -= 1;
      current += char;
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
      current += char;
      continue;
    }
    if (char === '}') {
      braceDepth -= 1;
      current += char;
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      current += char;
      continue;
    }
    if (char === ']') {
      bracketDepth -= 1;
      current += char;
      continue;
    }
    if (char === '<') {
      angleDepth += 1;
      current += char;
      continue;
    }
    if (char === '>' && angleDepth > 0) {
      angleDepth -= 1;
      current += char;
      continue;
    }

    if (char === ',' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0 && angleDepth === 0) {
      result.push(normalizeTitle(current));
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    result.push(normalizeTitle(current));
  }

  return result;
}

export function extractCStringLiteral(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!(trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed.slice(1, -1);
  }
}