import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { signPayload, verifyPayloadSignature } from "./auth";
import { logger } from "./logger";

/**
 * Binary storage boundary for evidence files. Local disk today; an S3/GCS
 * implementation only needs to satisfy this interface — routes do not change.
 */
export interface EvidenceBinaryStorage {
  readonly kind: string;
  put(key: string, data: Buffer): Promise<void>;
  createReadStream(key: string): Promise<Readable | null>;
  exists(key: string): Promise<boolean>;
}

class LocalDiskEvidenceStorage implements EvidenceBinaryStorage {
  readonly kind = "local-disk";
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    // Keys are server-generated UUID-based names; the join stays inside root.
    const resolved = path.join(this.root, key);
    if (!resolved.startsWith(this.root)) {
      throw new Error("Invalid evidence storage key");
    }
    return resolved;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async createReadStream(key: string): Promise<Readable | null> {
    if (!(await this.exists(key))) return null;
    return createReadStream(this.resolve(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      const info = await stat(this.resolve(key));
      return info.isFile();
    } catch {
      return false;
    }
  }
}

const storageRoot = path.resolve(
  process.env.EVIDENCE_STORAGE_DIR ?? path.join(process.cwd(), "data", "evidence"),
);

export const evidenceStorage: EvidenceBinaryStorage = new LocalDiskEvidenceStorage(storageRoot);
logger.info({ root: storageRoot }, "Evidence storage: local disk");

export function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

// ---- Signed download URLs ----------------------------------------------------

const DOWNLOAD_TTL_MS = 1000 * 60 * 15; // 15 minutes

export interface SignedDownload {
  /** Relative API path incl. query — client prefixes its API base URL. */
  path: string;
  expiresAt: string;
}

export function createSignedDownload(evidenceId: string): SignedDownload {
  const exp = Date.now() + DOWNLOAD_TTL_MS;
  const sig = signPayload(`evidence-download:${evidenceId}:${exp}`);
  return {
    path: `/evidence-files/${encodeURIComponent(evidenceId)}?exp=${exp}&sig=${sig}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

export function verifySignedDownload(evidenceId: string, exp: string, sig: string): boolean {
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs < Date.now()) return false;
  return verifyPayloadSignature(`evidence-download:${evidenceId}:${expMs}`, sig);
}
