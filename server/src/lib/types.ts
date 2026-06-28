export type Framework = 'gtest' | 'cunit';

export type SelectionMode = 'current_file' | 'selection';

export type ParseStrategy =
  | 'gtest_macro_block'
  | 'cunit_registration_plus_function'
  | 'cunit_registration_only';

export type ConflictStatus = 'none' | 'duplicate' | 'new_revision' | 'path_collision';

export type ScopeSource = 'service' | 'manual' | 'hint' | 'path_mapping';

export type ConflictPolicy = 'default' | 'allow_suffix';

export interface PathMappingRule {
  pattern: string;
  team: string;
  component: string;
  priority?: number;
}

export interface ScopeMatch {
  code: string;
  confidence: number;
  source: ScopeSource;
}

export interface ParsedCase {
  id: string;
  framework: Framework;
  fileName: string;
  sourceRelativePath: string;
  suiteName: string;
  caseName: string;
  displayName: string;
  sourceSnippet: string;
  normalizedTestCode: string;
  lineStart: number;
  lineEnd: number;
  parseConfidence: number;
  parseStrategy: ParseStrategy;
  warnings: string[];
  startOffset: number;
  endOffset: number;
}

export interface ParsePreviewRequest {
  sourceRelativePath: string;
  fileName: string;
  language: string;
  frameworkHint?: Framework;
  selectionMode: SelectionMode;
  selectionStart: number;
  selectionEnd: number;
  selectedText?: string;
  fullFileText: string;
}

export interface ParsePreviewResponse {
  framework: Framework;
  team?: ScopeMatch;
  component?: ScopeMatch;
  warnings: string[];
  cases: ParsedCase[];
}

export interface GenerateLabelsRequest {
  sourceRelativePath: string;
  fileName: string;
  framework: Framework;
  team: string;
  component: string;
  selectedIds: string[];
  cases: ParsedCase[];
}

export interface LabelResult {
  suiteName: string;
  caseName: string;
  caseHashFull: string;
  caseHash16B: string;
  contentHashFull: string;
  contentHash16B: string;
  label: string;
  isDuplicate: boolean;
  isNewRevision: boolean;
  conflictStatus: ConflictStatus;
  conflictReason: string;
}

export interface GenerateLabelsResponse {
  team: string;
  component: string;
  results: LabelResult[];
  warnings: string[];
  conflicts: Array<{
    suiteName: string;
    caseName: string;
    reason: string;
  }>;
}

export interface StoredLabelRecord {
  label: string;
  sourceRelativePath: string;
  fileName: string;
  framework: Framework;
  suiteName: string;
  caseName: string;
  caseHashFull: string;
  contentHashFull: string;
  team: string;
  component: string;
  generatedAt: string;
}