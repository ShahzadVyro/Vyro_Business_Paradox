import "server-only";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { google } from "googleapis";
import { getEnv } from "@/lib/env";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

const SUBFOLDER_NAMES = {
  Degree_Transcript_URL: "paradox_employee_degrees",
  Resume_URL: "paradox_employee_cvs",
  Last_Salary_Slip_URL: "paradox_employee_salary_slips",
  Experience_Letter_URL: "paradox_employee_experience_letters",
  Passport_Photo_URL: "paradox_employee_pictures",
  CNIC_Front_URL: "paradox_employee_cnic_front",
  CNIC_Back_URL: "paradox_employee_cnic_back",
} as const;

let materialisedCredentialsPath: string | null = null;

function resolveCredentialsPath(): string {
  if (materialisedCredentialsPath) return materialisedCredentialsPath;

  const inlineJson =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ??
    (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim().startsWith("{")
      ? process.env.GOOGLE_APPLICATION_CREDENTIALS
      : undefined);

  if (inlineJson) {
    const targetPath = path.join(os.tmpdir(), "gcp-service-account-drive.json");
    fs.writeFileSync(targetPath, inlineJson, { encoding: "utf-8" });
    materialisedCredentialsPath = targetPath;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = targetPath;
    return targetPath;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    materialisedCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  throw new Error("GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_JSON is not set");
}

function getDriveClient() {
  const keyFilename = resolveCredentialsPath();
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilename,
    scopes: [DRIVE_SCOPE],
  });
  return google.drive({ version: "v3", auth });
}

/**
 * Find or create a folder by name under parentId. Returns folder ID.
 */
async function ensureFolder(drive: ReturnType<typeof google.drive>, parentId: string, folderName: string): Promise<string> {
  const { data } = await drive.files.list({
    q: `'${parentId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    corpora: "allDrives",
  });
  const existing = data.files?.[0];
  if (existing?.id) return existing.id;

  const { data: created } = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.id) throw new Error(`Failed to create folder: ${folderName}`);
  return created.id;
}

/**
 * Upload a file to the given Drive folder, set "anyone with link can view", return view URL.
 */
async function uploadToFolder(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  file: { buffer: Buffer; mimeType: string; originalName: string }
): Promise<string> {
  const { data: fileData } = await drive.files.create({
    requestBody: {
      name: file.originalName,
      parents: [folderId],
    },
    media: {
      mimeType: file.mimeType,
      body: Readable.from(file.buffer),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!fileData.id) throw new Error("Drive upload did not return file id");

  await drive.permissions.create({
    fileId: fileData.id,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
    supportsAllDrives: true,
  });

  return `https://drive.google.com/file/d/${fileData.id}/view`;
}

/**
 * Map form field name to subfolder name and upload file. Returns Drive view URL or null if no file.
 */
export async function uploadOnboardingFile(
  fieldName: keyof typeof SUBFOLDER_NAMES,
  file: { buffer: Buffer; mimeType: string; originalName: string }
): Promise<string | null> {
  const rootId = getEnv("ONBOARDING_DRIVE_ROOT_FOLDER_ID");
  if (!rootId) throw new Error("ONBOARDING_DRIVE_ROOT_FOLDER_ID is not set");

  const folderName = SUBFOLDER_NAMES[fieldName];
  const drive = getDriveClient();
  const folderId = await ensureFolder(drive, rootId, folderName);
  const url = await uploadToFolder(drive, folderId, file);
  return url;
}

export { SUBFOLDER_NAMES };
