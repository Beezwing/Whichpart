import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');

/**
 * Local-disk file storage for development. Verification documents are
 * sensitive (Section 78) so files are never served from a public static
 * folder — only through an authenticated controller that streams bytes
 * after checking the requester owns the record or is an admin.
 *
 * This is intentionally the ONLY place that knows files live on disk.
 * Phase 4 swaps this implementation for Cloudflare R2 (Section 14) without
 * any caller needing to change — they only ever see a `key` string.
 */
@Injectable()
export class StorageService {
  async save(buffer: Buffer, originalFilename: string): Promise<string> {
    await mkdir(UPLOAD_ROOT, { recursive: true });
    const extension = originalFilename.includes('.')
      ? originalFilename.slice(originalFilename.lastIndexOf('.'))
      : '';
    const key = `${randomUUID()}${extension}`;
    await writeFile(join(UPLOAD_ROOT, key), buffer);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return readFile(join(UPLOAD_ROOT, key));
  }

  async delete(key: string): Promise<void> {
    await rm(join(UPLOAD_ROOT, key), { force: true });
  }
}
