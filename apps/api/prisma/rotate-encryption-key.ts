/**
 * Re-encrypts every secret stored with CryptoService (supplier payment
 * credentials + QuickBooks tokens) from one ENCRYPTION_KEY to another.
 * Same AES-256-GCM format as src/common/crypto.service.ts.
 *
 * Dry run (default) decrypts everything with the old key and reports counts
 * without writing. Pass --apply to write, all in one transaction. Safe to
 * re-run: values that already decrypt with the new key are skipped.
 *
 * Run with:
 *   OLD_ENCRYPTION_KEY=<64 hex> NEW_ENCRYPTION_KEY=<64 hex> \
 *     npx ts-node --compiler-options {"module":"commonjs"} prisma/rotate-encryption-key.ts [--apply]
 * DATABASE_URL comes from apps/api/.env as usual.
 */
import { PrismaClient } from "@prisma/client";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function loadKey(name: string): Buffer {
  const key = Buffer.from(process.env[name] ?? "", "hex");
  if (key.length !== 32) throw new Error(`${name} must be a 32-byte (64 hex character) value.`);
  return key;
}

function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

function tryDecrypt(key: Buffer, payload: string): string | null {
  try {
    const raw = Buffer.from(payload, "base64");
    const decipher = createDecipheriv(ALGORITHM, key, raw.subarray(0, IV_LENGTH));
    decipher.setAuthTag(raw.subarray(IV_LENGTH, IV_LENGTH + 16));
    return Buffer.concat([decipher.update(raw.subarray(IV_LENGTH + 16)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const oldKey = loadKey("OLD_ENCRYPTION_KEY");
  const newKey = loadKey("NEW_ENCRYPTION_KEY");
  if (oldKey.equals(newKey)) throw new Error("OLD and NEW keys are the same.");

  let rotated = 0;
  let alreadyNew = 0;
  const failures: string[] = [];

  /** Returns the re-encrypted value, or undefined when nothing should change. */
  function rekey(label: string, value: string | null): string | undefined {
    if (value == null) return undefined;
    if (tryDecrypt(newKey, value) !== null) {
      alreadyNew++;
      return undefined;
    }
    const plaintext = tryDecrypt(oldKey, value);
    if (plaintext === null) {
      failures.push(label);
      return undefined;
    }
    rotated++;
    return encrypt(newKey, plaintext);
  }

  const paymentUpdates = (await prisma.supplierPaymentAccount.findMany()).flatMap((a) => {
    const encryptedApiKey = rekey(`SupplierPaymentAccount ${a.id} apiKey`, a.encryptedApiKey);
    const encryptedApiSecret = rekey(`SupplierPaymentAccount ${a.id} apiSecret`, a.encryptedApiSecret);
    if (encryptedApiKey === undefined && encryptedApiSecret === undefined) return [];
    return [prisma.supplierPaymentAccount.update({ where: { id: a.id }, data: { encryptedApiKey, encryptedApiSecret } })];
  });

  const quickBooksUpdates = (await prisma.supplierQuickBooksAccount.findMany()).flatMap((a) => {
    const encryptedAccessToken = rekey(`SupplierQuickBooksAccount ${a.id} accessToken`, a.encryptedAccessToken);
    const encryptedRefreshToken = rekey(`SupplierQuickBooksAccount ${a.id} refreshToken`, a.encryptedRefreshToken);
    if (encryptedAccessToken === undefined && encryptedRefreshToken === undefined) return [];
    return [prisma.supplierQuickBooksAccount.update({ where: { id: a.id }, data: { encryptedAccessToken, encryptedRefreshToken } })];
  });

  console.log(`To re-encrypt: ${rotated}. Already on new key: ${alreadyNew}. Unreadable with either key: ${failures.length}.`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  cannot decrypt: ${f}`));
    throw new Error("Aborting without writing — check OLD_ENCRYPTION_KEY.");
  }

  if (!apply) {
    console.log("Dry run — nothing written. Re-run with --apply to save.");
    return;
  }
  await prisma.$transaction([...paymentUpdates, ...quickBooksUpdates]);
  console.log(`Re-encrypted ${rotated} values with the new key.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
