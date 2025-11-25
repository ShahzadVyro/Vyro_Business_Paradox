import { randomUUID } from "crypto";
import { getBigQueryClient } from "@/lib/bigquery";
import type { OnboardingFormInput, OnboardingSubmission } from "@/types/onboarding";
import { postSlackMessage, SLACK_CHANNEL_ID } from "@/lib/slack";
import { getEnv } from "@/lib/env";

const BQ_DATASET = getEnv("BQ_DATASET");
const BQ_INTAKE_TABLE = getEnv("BQ_INTAKE_TABLE");
const SLACK_NEW_JOINER_CHANNEL = getEnv("SLACK_NEW_JOINER_CHANNEL");

if (!BQ_DATASET) {
  throw new Error("Missing BigQuery dataset configuration for onboarding");
}

const intakeTable = BQ_INTAKE_TABLE ?? "EmployeeIntake_v1";
const projectId = getEnv("GCP_PROJECT_ID");
if (!projectId) {
  throw new Error("Missing GCP_PROJECT_ID for onboarding");
}
const employeeTableName = getEnv("BQ_TABLE") ?? "EmployeeDirectoryLatest_v1";
const intakeTableRef = `\`${projectId}.${BQ_DATASET}.${intakeTable}\``;
const employeeTableRef = `\`${projectId}.${BQ_DATASET}.${employeeTableName}\``;

let tableEnsured = false;
const ensureIntakeTable = async () => {
  if (tableEnsured) return;
  const bigquery = getBigQueryClient();
  await bigquery.query(`
    CREATE TABLE IF NOT EXISTS ${intakeTableRef} (
      Submission_ID STRING NOT NULL,
      Status STRING,
      Payload JSON,
      Slack_TS STRING,
      Slack_Channel STRING,
      Approved_By STRING,
      Employee_ID STRING,
      Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
    )
  `);
  tableEnsured = true;
};

const sanitizePhone = (value: string) => value.replace(/[^\d+]/g, "");

export const createOnboardingSubmission = async (input: OnboardingFormInput) => {
  await ensureIntakeTable();
  const bigquery = getBigQueryClient();
  const submissionId = randomUUID();
  const payload = {
    ...input,
    Contact_Number: sanitizePhone(input.Contact_Number),
    Emergency_Contact_Number: sanitizePhone(input.Emergency_Contact_Number),
  };

  const query = `
    INSERT INTO ${intakeTableRef} (Submission_ID, Status, Payload)
    VALUES (@submissionId, "pending", TO_JSON(@payload))
  `;
  await bigquery.query({
    query,
    params: {
      submissionId,
      payload,
    },
  });
  return { submissionId, payload };
};

export const listOnboardingSubmissions = async (status?: string) => {
  await ensureIntakeTable();
  const bigquery = getBigQueryClient();
  const conditions = status ? "WHERE Status = @status" : "";
  const query = `
    SELECT Submission_ID, Status, Payload, Slack_TS, Slack_Channel, Approved_By, Employee_ID,
           FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', Created_At, 'Asia/Karachi') AS Created_At,
           FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', Updated_At, 'Asia/Karachi') AS Updated_At
    FROM ${intakeTableRef}
    ${conditions}
    ORDER BY Created_At DESC
  `;
  const [rows] = await bigquery.query({
    query,
    params: status ? { status } : undefined,
  });
  return rows.map((row) => ({
    Submission_ID: row.Submission_ID,
    Status: row.Status,
    Slack_TS: row.Slack_TS,
    Slack_Channel: row.Slack_Channel,
    Approved_By: row.Approved_By,
    Employee_ID: row.Employee_ID,
    Created_At: row.Created_At,
    Updated_At: row.Updated_At,
    ...normalizePayload(row.Payload),
  })) as OnboardingSubmission[];
};

export const getSubmissionById = async (submissionId: string) => {
  await ensureIntakeTable();
  const bigquery = getBigQueryClient();
  const query = `
    SELECT Submission_ID, Status, Payload, Slack_TS, Slack_Channel, Approved_By, Employee_ID,
           FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', Created_At, 'Asia/Karachi') AS Created_At,
           FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', Updated_At, 'Asia/Karachi') AS Updated_At
    FROM ${intakeTableRef}
    WHERE Submission_ID = @submissionId
    LIMIT 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { submissionId },
  });
  const row = rows[0];
  if (!row) return null;
  return {
    Submission_ID: row.Submission_ID,
    Status: row.Status,
    Slack_TS: row.Slack_TS,
    Slack_Channel: row.Slack_Channel,
    Approved_By: row.Approved_By,
    Employee_ID: row.Employee_ID,
    Created_At: row.Created_At,
    Updated_At: row.Updated_At,
    ...normalizePayload(row.Payload),
  } as OnboardingSubmission;
};

const normalizePayload = (payload: unknown): Record<string, unknown> => {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  if (typeof payload === "object") {
    return payload as Record<string, unknown>;
  }
  return {};
};

export const updateSubmissionMeta = async (
  submissionId: string,
  updates: { status?: string; slackTs?: string; slackChannel?: string; approvedBy?: string | null; employeeId?: string | null },
) => {
  await ensureIntakeTable();
  const bigquery = getBigQueryClient();
  const query = `
    UPDATE ${intakeTableRef}
    SET
      Status = COALESCE(@status, Status),
      Slack_TS = COALESCE(@slackTs, Slack_TS),
      Slack_Channel = COALESCE(@slackChannel, Slack_Channel),
      Approved_By = COALESCE(@approvedBy, Approved_By),
      Employee_ID = COALESCE(@employeeId, Employee_ID),
      Updated_At = CURRENT_TIMESTAMP()
    WHERE Submission_ID = @submissionId
  `;
  await bigquery.query({
    query,
    params: {
      submissionId,
      status: updates.status ?? null,
      slackTs: updates.slackTs ?? null,
      slackChannel: updates.slackChannel ?? null,
      approvedBy: updates.approvedBy ?? null,
      employeeId: updates.employeeId ?? null,
    },
  });
};

const columnMap: Record<string, keyof OnboardingFormInput> = {
  Full_Name: "Full_Name",
  Personal_Email: "Personal_Email",
  Official_Email: "Official_Email",
  Joining_Date: "Joining_Date",
  Designation: "Designation",
  Department: "Department",
  Reporting_Manager: "Reporting_Manager",
  Job_Type: "Job_Type",
  Contact_Number: "Contact_Number",
  "CNIC / ID": "CNIC_ID",
  Gender: "Gender",
  Bank_Name: "Bank_Name",
  Bank_Account_Title: "Bank_Account_Title",
  "Bank Account Number-IBAN (24 digits)": "Bank_Account_Number_IBAN",
  "Swift Code/ BIC Code": "Swift_Code_BIC",
  "Father's Name": "Father_Name",
  "Emergency Contact's Relationship": "Emergency_Contact_Relationship",
  "Emergency Contact Number": "Emergency_Contact_Number",
  Blood_Group: "Blood_Group",
  "LinkedIn URL": "LinkedIn_URL",
  "Recruiter Name": "Recruiter_Name",
  "Date of Birth": "Date_of_Birth",
  Address: "Current_Address",
  Nationality: "Nationality",
  "Marital Status": "Marital_Status",
};

export const getNextEmployeeId = async () => {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT CAST(MAX(CAST(Employee_ID AS INT64)) + 1 AS STRING) AS nextId
    FROM ${employeeTableRef}
  `;
  const [rows] = await bigquery.query({ query });
  const nextId = rows[0]?.nextId;
  return nextId ?? "5000";
};

export const insertEmployeeFromSubmission = async (submission: OnboardingSubmission, employeeId: string) => {
  const bigquery = getBigQueryClient();
  const payload = submission as Record<string, unknown>;
  const columns = ["Employee_ID", ...Object.keys(columnMap)];
  const payloadRow = columns.map((col) => {
    if (col === "Employee_ID") return employeeId;
    const key = columnMap[col as keyof typeof columnMap];
    return key ? payload[key] ?? null : null;
  });

  const placeholders = columns.map((_, idx) => `@col${idx}`);
  const insertQuery = `
    INSERT INTO ${employeeTableRef} (${columns.join(", ")})
    VALUES (${placeholders.join(", ")})
  `;

  const params: Record<string, unknown> = {};
  columns.forEach((_, idx) => {
    params[`col${idx}`] = payloadRow[idx];
  });

  await bigquery.query({
    query: insertQuery,
    params,
  });
};

export const notifySlackForSubmission = async ({
  submissionId,
  submission,
}: {
  submissionId: string;
  submission: OnboardingFormInput;
}) => {
  const summary = `*New Joiner Submission*\n*Name:* ${submission.Full_Name}\n*Joining Date:* ${submission.Joining_Date}\n*Email:* ${submission.Official_Email}\n*Department:* ${submission.Department}\n*Designation:* ${submission.Designation}\n*Recruiter:* ${submission.Recruiter_Name}`;
  const blockPayload = {
    channel: SLACK_NEW_JOINER_CHANNEL ?? SLACK_CHANNEL_ID,
    text: summary,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: summary } },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "✅ Confirm Onboarding" },
            style: "primary",
            value: JSON.stringify({ submissionId, action: "onboard" }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "❌ Cancel Entry" },
            style: "danger",
            value: JSON.stringify({ submissionId, action: "cancel" }),
          },
        ],
      },
    ],
  };
  const res = await postSlackMessage(blockPayload);
  if (res?.ts && res?.channel) {
    await updateSubmissionMeta(submissionId, {
      slackTs: res.ts,
      slackChannel: res.channel,
    });
  } else {
    console.warn("[ONBOARDING_SLACK_SKIP] Slack not configured. Submission stored without notification.", submissionId);
  }
  return res;
};

