import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac, randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');

const sha256Hex = (data: Buffer | string) =>
  createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string) =>
  createHmac('sha256', key).update(data).digest();

/**
 * File storage behind a `key` string. Callers never know where bytes live.
 *
 * With the CLOUDFLARE_R2_* variables set, files go to an R2 bucket (S3
 * API, signed with SigV4 over plain fetch -- same no-SDK approach as the
 * other external services) and survive redeploys. Without them it falls
 * back to local disk, which is fine for development but is wiped on every
 * Railway deploy unless a volume is mounted at ./uploads.
 *
 * Verification documents are sensitive (Section 78): the bucket must stay
 * private. Files are only ever served through authenticated controllers
 * (or, for product photos, the public image controller) that stream bytes.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  private readonly accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  private readonly accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  private readonly secretAccessKey =
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  private readonly bucket = process.env.CLOUDFLARE_R2_BUCKET;

  constructor() {
    this.logger.log(
      this.useR2()
        ? `Using Cloudflare R2 bucket "${this.bucket}" for uploads.`
        : 'R2 not configured -- uploads use local disk and are lost on redeploy.',
    );
  }

  private useR2(): boolean {
    return !!(
      this.accountId &&
      this.accessKeyId &&
      this.secretAccessKey &&
      this.bucket
    );
  }

  async save(buffer: Buffer, originalFilename: string): Promise<string> {
    const extension = originalFilename.includes('.')
      ? originalFilename.slice(originalFilename.lastIndexOf('.'))
      : '';
    const key = `${randomUUID()}${extension}`;
    if (this.useR2()) {
      await this.r2('PUT', key, buffer);
      return key;
    }
    await mkdir(UPLOAD_ROOT, { recursive: true });
    await writeFile(join(UPLOAD_ROOT, key), buffer);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    if (this.useR2()) {
      const res = await this.r2('GET', key);
      return Buffer.from(await res.arrayBuffer());
    }
    return readFile(join(UPLOAD_ROOT, key));
  }

  async delete(key: string): Promise<void> {
    if (this.useR2()) {
      await this.r2('DELETE', key);
      return;
    }
    await rm(join(UPLOAD_ROOT, key), { force: true });
  }

  /** Minimal AWS SigV4 request against R2's S3-compatible endpoint. */
  private async r2(
    method: 'PUT' | 'GET' | 'DELETE',
    key: string,
    body?: Buffer,
  ): Promise<Response> {
    const host = `${this.accountId}.r2.cloudflarestorage.com`;
    const path = `/${this.bucket}/${encodeURIComponent(key)}`;
    const payloadHash = sha256Hex(body ?? '');
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const scope = `${dateStamp}/${region}/s3/aws4_request`;

    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      method,
      path,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kSigning = hmac(hmac(hmac(kDate, region), 's3'), 'aws4_request');
    const signature = createHmac('sha256', kSigning)
      .update(stringToSign)
      .digest('hex');

    const res = await fetch(`https://${host}${path}`, {
      method,
      headers: {
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      body: body ? new Uint8Array(body) : undefined,
    });
    if (!res.ok && !(method === 'DELETE' && res.status === 404)) {
      throw new Error(
        `R2 ${method} ${key} failed: ${res.status} ${(await res.text()).slice(0, 200)}`,
      );
    }
    return res;
  }
}
