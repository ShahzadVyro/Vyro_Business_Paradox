import 'server-only';
import { BigQuery } from '@google-cloud/bigquery';

let client: BigQuery | null = null;

export const getBigQueryClient = () => {
  if (!client) {
    if (!process.env.GCP_PROJECT_ID) {
      throw new Error('GCP_PROJECT_ID is not set');
    }
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS path is not set');
    }

    client = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
  return client;
};

