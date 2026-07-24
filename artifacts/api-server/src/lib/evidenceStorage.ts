import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { signPayload, verifyPayloadSignature } from "./auth";
import { logger } from "./logger";

/**
 * Binary storage boundary for evidence files (roadmap Phase 4.3 / E2).
 * Local disk by default; S3-compatible object storage when EVIDENCE_S3_BUCKET
 * is set — routes do not change, and the HMAC signed-URL scheme stays (the
 * bucket remains private; the API streams objects to authorized callers).
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

/**
 * S3-compatible storage: AWS S3, Cloudflare R2, MinIO, GCS interop — anything
 * speaking the S3 API. Credentials come from the standard AWS SDK chain
 * (env vars, instance profile, etc.); EVIDENCE_S3_ENDPOINT overrides the
 * endpoint for non-AWS providers.
 */
class S3EvidenceStorage implements EvidenceBinaryStorage {
  readonly kind = "s3";
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    private readonly prefix: string,
  ) {
    const endpoint = process.env.EVIDENCE_S3_ENDPOINT;
    this.client = new S3Client({
      ...(process.env.EVIDENCE_S3_REGION ? { region: process.env.EVIDENCE_S3_REGION } : {}),
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }

  private objectKey(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  async put(key: string, data: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key), Body: data }),
    );
  }

  async createReadStream(key: string): Promise<Readable | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
      );
      return (result.Body as Readable | undefined) ?? null;
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      logger.error({ err, key }, "S3 evidence read failed");
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
      );
      return true;
    } catch {
      return false;
    }
  }
}

function createEvidenceStorage(): EvidenceBinaryStorage {
  const bucket = process.env.EVIDENCE_S3_BUCKET;
  if (bucket) {
    const prefix = process.env.EVIDENCE_S3_PREFIX ?? "evidence";
    logger.info({ bucket, prefix }, "Evidence storage: S3-compatible object store");
    return new S3EvidenceStorage(bucket, prefix);
  }
  const storageRoot = path.resolve(
    process.env.EVIDENCE_STORAGE_DIR ?? path.join(process.cwd(), "data", "evidence"),
  );
  logger.info({ root: storageRoot }, "Evidence storage: local disk");
  return new LocalDiskEvidenceStorage(storageRoot);
}

export const evidenceStorage: EvidenceBinaryStorage = createEvidenceStorage();

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
