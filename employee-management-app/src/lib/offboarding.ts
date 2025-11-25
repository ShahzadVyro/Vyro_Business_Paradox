import 'server-only';
import { getBigQueryClient } from '@/lib/bigquery';
import type { EmployeeOffboardingRecord } from '@/types/employee';

const { BQ_DATASET, BQ_OFFBOARDING_TABLE } = process.env;

if (!BQ_DATASET) {
  throw new Error('Missing BigQuery dataset configuration');
}

const offboardingTable = BQ_OFFBOARDING_TABLE ?? 'EmployeeOffboarding_v1';
const offboardingTableRef = `\`${process.env.GCP_PROJECT_ID}.${BQ_DATASET}.${offboardingTable}\``;
let tableEnsured = false;

const ensureOffboardingTable = async () => {
  if (tableEnsured) return;
  const bigquery = getBigQueryClient();
  await bigquery.query(`
    CREATE TABLE IF NOT EXISTS ${offboardingTableRef} (
      Employee_ID STRING NOT NULL,
      Offboarding_Status STRING,
      Employment_End_Date STRING,
      Employment_End_Date_ISO STRING,
      Note STRING,
      Scheduled_By STRING,
      Updated_At TIMESTAMP
    )
  `);
  tableEnsured = true;
};

export const fetchOffboardingRecord = async (employeeId: string): Promise<EmployeeOffboardingRecord | null> => {
  await ensureOffboardingTable();
  const bigquery = getBigQueryClient();
  const query = `
    SELECT *
    FROM ${offboardingTableRef}
    WHERE Employee_ID = @employeeId
    LIMIT 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId },
  });
  return (rows[0] as EmployeeOffboardingRecord) ?? null;
};

export const upsertOffboardingRecord = async ({
  employeeId,
  employmentEndDate,
  note,
  status,
  user,
}: {
  employeeId: string;
  employmentEndDate: string;
  note?: string | null;
  status: 'scheduled' | 'completed';
  user?: string | null;
}) => {
  await ensureOffboardingTable();
  const bigquery = getBigQueryClient();
  const query = `
    MERGE ${offboardingTableRef} T
    USING (SELECT @employeeId AS Employee_ID) S
    ON T.Employee_ID = S.Employee_ID
    WHEN MATCHED THEN
      UPDATE SET
        Offboarding_Status = @status,
        Employment_End_Date = @employmentEndDate,
        Employment_End_Date_ISO = @employmentEndDate,
        Note = @note,
        Scheduled_By = @user,
        Updated_At = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
      INSERT (Employee_ID, Offboarding_Status, Employment_End_Date, Employment_End_Date_ISO, Note, Scheduled_By, Updated_At)
      VALUES (@employeeId, @status, @employmentEndDate, @employmentEndDate, @note, @user, CURRENT_TIMESTAMP())
  `;
  await bigquery.query({
    query,
    params: {
      employeeId,
      employmentEndDate,
      note: note ?? null,
      user: user ?? 'dashboard@vyro.ai',
      status,
    },
    types: {
      employeeId: 'STRING',
      employmentEndDate: 'STRING',
      note: 'STRING',
      user: 'STRING',
      status: 'STRING',
    },
  });
  return fetchOffboardingRecord(employeeId);
};

export const clearOffboardingRecord = async (employeeId: string) => {
  await ensureOffboardingTable();
  const bigquery = getBigQueryClient();
  const query = `
    DELETE FROM ${offboardingTableRef}
    WHERE Employee_ID = @employeeId
  `;
  await bigquery.query({
    query,
    params: { employeeId },
  });
};

export const listUpcomingOffboarding = async () => {
  await ensureOffboardingTable();
  const bigquery = getBigQueryClient();
  const query = `
    SELECT *
    FROM ${offboardingTableRef}
    WHERE Offboarding_Status = 'scheduled'
  `;
  const [rows] = await bigquery.query({ query });
  return rows as EmployeeOffboardingRecord[];
};

export const ensureOffboardingTableExists = async () => ensureOffboardingTable();

