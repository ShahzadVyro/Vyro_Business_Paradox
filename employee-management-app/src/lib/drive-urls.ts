/**
 * Helpers for Google Drive view/share URLs: extract file ID and build preview/download URLs
 * for in-dashboard embedding and download (e.g. iframe preview, download link).
 */

const DRIVE_FILE_ID_REGEX = /\/file\/d\/([a-zA-Z0-9_-]+)/;

/**
 * Extract Google Drive file ID from a view or share URL.
 * Supports URLs like: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 */
export function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string" || !url.trim()) return null;
  const match = url.trim().match(DRIVE_FILE_ID_REGEX);
  return match ? match[1] : null;
}

/**
 * Build Drive preview URL for embedding (iframe). Works for PDFs and images.
 */
export function getDrivePreviewUrl(url: string | null | undefined): string | null {
  const fileId = extractDriveFileId(url);
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;
}

/**
 * Build Drive direct download URL.
 */
export function getDriveDownloadUrl(url: string | null | undefined): string | null {
  const fileId = extractDriveFileId(url);
  return fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : null;
}
