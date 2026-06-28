import * as vscode from 'vscode';

import type { ConflictPolicy, GenerationSession, LabelResult, ReviewSession, StoredLabelRecord } from './types';
import { buildCaseHash, buildContentHash, buildLabel, buildPathSuffix8 } from './utils';

const STORAGE_KEY = 'testTrace.generatedLabels';

export class LabelStore {
  public constructor(private readonly state: vscode.Memento) {}

  public async getAll(): Promise<StoredLabelRecord[]> {
    return this.state.get<StoredLabelRecord[]>(STORAGE_KEY, []);
  }

  public async saveAll(records: StoredLabelRecord[]): Promise<void> {
    await this.state.update(STORAGE_KEY, records);
  }
}

export async function generateLabels(
  review: ReviewSession,
  selectedIds: string[],
  team: string,
  component: string,
  policy: ConflictPolicy,
  store: LabelStore
): Promise<GenerationSession> {
  const allRecords = await store.getAll();
  const results: LabelResult[] = [];
  const conflicts: GenerationSession['conflicts'] = [];
  const recordsToAppend: StoredLabelRecord[] = [];

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
    const siblings = allRecords.filter((record) => record.caseHashFull === caseHash.full);
    const samePath = siblings.find(
      (record) =>
        record.contentHashFull === contentHash.full &&
        record.sourceRelativePath === review.sourceRelativePath &&
        record.suiteName === parsedCase.suiteName &&
        record.caseName === parsedCase.caseName
    );
    const pathCollision = siblings.find(
      (record) =>
        record.contentHashFull === contentHash.full &&
        record.sourceRelativePath !== review.sourceRelativePath
    );
    const newRevision = siblings.find((record) => record.contentHashFull !== contentHash.full);

    let conflictStatus: LabelResult['conflictStatus'] = 'none';
    let conflictReason = '';
    let isDuplicate = false;
    let isNewRevision = false;
    let pathSuffix8: string | undefined;

    if (samePath) {
      conflictStatus = 'duplicate';
      conflictReason = 'Same CASE_HASH, CONTENT_HASH, and source path already exist.';
      isDuplicate = true;
    } else if (pathCollision) {
      conflictStatus = 'path_collision';
      conflictReason = 'Same CASE_HASH and CONTENT_HASH exist under a different source path.';
      if (policy === 'allow_suffix') {
        pathSuffix8 = buildPathSuffix8(review.sourceRelativePath);
        conflictReason = 'Path collision resolved by appending a path suffix.';
      }
    } else if (newRevision) {
      conflictStatus = 'new_revision';
      conflictReason = 'CASE_HASH already exists with different CONTENT_HASH.';
      isNewRevision = true;
    }

    const label = buildLabel({
      team,
      component,
      caseHash16B: caseHash.short16B,
      contentHash16B: contentHash.short16B,
      pathSuffix8
    });

    const result: LabelResult = {
      suiteName: parsedCase.suiteName,
      caseName: parsedCase.caseName,
      caseHashFull: caseHash.full,
      caseHash16B: caseHash.short16B,
      contentHashFull: contentHash.full,
      contentHash16B: contentHash.short16B,
      label,
      isDuplicate,
      isNewRevision,
      conflictStatus,
      conflictReason
    };
    results.push(result);

    if (conflictStatus === 'path_collision' && policy !== 'allow_suffix') {
      conflicts.push({
        suiteName: parsedCase.suiteName,
        caseName: parsedCase.caseName,
        reason: conflictReason
      });
      continue;
    }

    if (isDuplicate) {
      continue;
    }

    recordsToAppend.push({
      label,
      sourceRelativePath: review.sourceRelativePath,
      fileName: review.fileName,
      framework: review.framework,
      suiteName: parsedCase.suiteName,
      caseName: parsedCase.caseName,
      caseHashFull: caseHash.full,
      contentHashFull: contentHash.full,
      team,
      component,
      generatedAt: new Date().toISOString()
    });
  }

  if (recordsToAppend.length > 0) {
    await store.saveAll([...allRecords, ...recordsToAppend]);
  }

  return {
    review: {
      ...review,
      team,
      component
    },
    results,
    warnings: [],
    conflicts
  };
}