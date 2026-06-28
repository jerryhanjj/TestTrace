import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { StoredLabelRecord } from './types';
import type { LabelStore } from './labels';

export class FileLabelStore implements LabelStore {
  public constructor(private readonly dataDir: string) {}

  public async getAll(): Promise<StoredLabelRecord[]> {
    const filePath = this.getFilePath();
    try {
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content) as StoredLabelRecord[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  public async saveAll(records: StoredLabelRecord[]): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.getFilePath(), JSON.stringify(records, null, 2), 'utf8');
  }

  private getFilePath(): string {
    return path.join(this.dataDir, 'testtrace-labels.json');
  }
}