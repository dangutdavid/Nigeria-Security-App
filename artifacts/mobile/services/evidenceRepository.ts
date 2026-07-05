import { mobileApiFetch } from "@/services/apiClient";
import { getMobileApiConfig, shouldUseApi } from "@/services/apiConfig";

/**
 * Uploads report evidence to the backend evidence pipeline: metadata first
 * (POST /reports/{id}/evidence), then the binary (PUT .../content). Best
 * effort by design — a failed upload never blocks the report itself, and the
 * local photoUri remains on the report as the offline fallback.
 */

interface EvidenceMetadataResponse {
  id?: string;
}

function guessMimeType(uri: string): string {
  const ext = uri.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  return "image/jpeg";
}

/**
 * Attach a photo to a submitted report. Returns true when both metadata and
 * binary reached the backend. Safe to fire-and-forget.
 */
export async function uploadReportPhoto(
  reportReference: string,
  photoUri: string,
): Promise<boolean> {
  if (!shouldUseApi() || !photoUri) return false;

  const fileName = photoUri.split("?")[0].split("/").pop() ?? "photo.jpg";
  const mimeType = guessMimeType(photoUri);

  const meta = await mobileApiFetch<EvidenceMetadataResponse>({
    method: "POST",
    path: `/reports/${encodeURIComponent(reportReference)}/evidence`,
    body: { kind: "photo", uri: photoUri, fileName, mimeType },
  });
  if (!meta.ok || !meta.data.id) {
    if (shouldUseApi()) {
      console.warn(`[evidenceRepository] metadata upload failed: ${meta.ok ? "no id" : meta.error}`);
    }
    return false;
  }

  try {
    // Read the local file (photo library / camera uri) as raw bytes.
    const fileResponse = await fetch(photoUri);
    const bytes = await fileResponse.arrayBuffer();

    const config = getMobileApiConfig();
    const upload = await fetch(
      `${config.baseUrl}/reports/${encodeURIComponent(reportReference)}/evidence/${encodeURIComponent(meta.data.id)}/content`,
      {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: bytes,
      },
    );
    if (!upload.ok) {
      console.warn(`[evidenceRepository] binary upload failed: HTTP ${upload.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(
      `[evidenceRepository] binary upload failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return false;
  }
}
