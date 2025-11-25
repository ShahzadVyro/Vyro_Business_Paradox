import "server-only";
import fs from "fs";
import os from "os";
import path from "path";
import { BigQuery } from "@google-cloud/bigquery";

let client: BigQuery | null = null;
let materialisedCredentialsPath: string | null = null;

const resolveCredentialsFile = () => {
  if (materialisedCredentialsPath) {
    return materialisedCredentialsPath;
  }

  const inlineJson =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ??
    (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim().startsWith("{")
      ? process.env.GOOGLE_APPLICATION_CREDENTIALS
      : undefined);

  if (inlineJson) {
    const targetPath = path.join(os.tmpdir(), "gcp-service-account.json");
    fs.writeFileSync(targetPath, inlineJson, { encoding: "utf-8" });
    materialisedCredentialsPath = targetPath;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = targetPath;
    return targetPath;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    materialisedCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return materialisedCredentialsPath;
  }

  return null;
};

export const getBigQueryClient = () => {
  if (!client) {
    if (!process.env.GCP_PROJECT_ID) {
      throw new Error("GCP_PROJECT_ID is not set");
    }
    const keyFilename = resolveCredentialsFile();
    if (!keyFilename) {
      throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set");
    }

    client = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename,
    });
  }
  return client;
};

