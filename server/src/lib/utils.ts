import crypto from 'node:crypto';
import path from 'node:path';

import type { Framework } from './types';

export function normalizeUnicodeNfc(value: string): string {
  return value.normalize('NFC');
}

export function normalizeToken(value: string): string {
  return normalizeUnicodeNfc(value).trim();
}

export function normalizeTitle(value: string): string {
  return normalizeUnicodeNfc(value).trim().replace(/\s+/g, ' ');
}

export function normalizeCode(value: string): string {
  return normalizeUnicodeNfc(value)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

export function normalizePath(value: string): string {
  return normalizeUnicodeNfc(value)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/')
    .trim();
}

export function getFileName(filePath: string): string {
  return path.basename(filePath);
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex').toUpperCase();
}

export function short16Bytes(fullHex: string): string {
  return fullHex.slice(0, 32).toUpperCase();
}

export function sanitizeScopeCode(value: string): string {
  return normalizeToken(value).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'UNKNOWN';
}

export function buildCaseHash(input: {
  fileName: string;
  framework: Framework;
  suiteName: string;
  caseName: string;
}): { full: string; short16B: string } {
  const payload = {
    file_name: normalizeTitle(input.fileName),
    framework: normalizeToken(input.framework).toLowerCase(),
    suite_name: normalizeTitle(input.suiteName),
    case_name: normalizeTitle(input.caseName)
  };
  const full = sha256Hex(stableStringify(payload));
  return { full, short16B: short16Bytes(full) };
}

export function buildContentHash(input: {
  framework: Framework;
  caseName: string;
  normalizedTestCode: string;
}): { full: string; short16B: string } {
  const payload = {
    framework: normalizeToken(input.framework).toLowerCase(),
    case_name: normalizeTitle(input.caseName),
    normalized_test_code: normalizeCode(input.normalizedTestCode)
  };
  const full = sha256Hex(stableStringify(payload));
  return { full, short16B: short16Bytes(full) };
}

export function buildPathSuffix8(sourceRelativePath: string): string {
  return sha256Hex(normalizePath(sourceRelativePath)).slice(0, 8);
}

export function buildLabel(input: {
  team: string;
  component: string;
  caseHash16B: string;
  contentHash16B: string;
  pathSuffix8?: string;
}): string {
  const now = new Date();
  const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const parts = [
    'AI',
    'UT',
    sanitizeScopeCode(input.component),
    today,
    input.caseHash16B,
    input.contentHash16B
  ];
  if (input.pathSuffix8) {
    parts.push(`P${input.pathSuffix8}`);
  }
  return parts.join('_');
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}