import { randomUUID } from "crypto";
import { getBigQueryClient } from "@/lib/bigquery";
import type { OnboardingFormInput, OnboardingSubmission } from "@/types/onboarding";
import { postSlackMessage, SLACK_CHANNEL_ID } from "@/lib/slack";
import { getEnv } from "@/lib/env";
import { formatDateWithDay } from "@/lib/formatters";

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
const employeeTableName = getEnv("BQ_TABLE") ?? "Employees";
const intakeTableRef = `\`${projectId}.${BQ_DATASET}.${intakeTable}\``;
const employeeTableRef = `\`${projectId}.${BQ_DATASET}.${employeeTableName}\``;
const lifecycleEventsTableRef = `\`${projectId}.${BQ_DATASET}.Employee_Lifecycle_Events\``;

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

  // Insert into intake table only - employee will be created when confirmed via Slack
  const intakeQuery = `
    INSERT INTO ${intakeTableRef} (Submission_ID, Status, Payload)
    VALUES (@submissionId, "pending", TO_JSON(@payload))
  `;
  await bigquery.query({
    query: intakeQuery,
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
    types: {
      submissionId: "STRING",
      status: "STRING",
      slackTs: "STRING",
      slackChannel: "STRING",
      approvedBy: "STRING",
      employeeId: "STRING",
    },
  });
};

export const updateSubmissionPayload = async (submissionId: string, payload: Partial<OnboardingFormInput>) => {
  await ensureIntakeTable();
  const bigquery = getBigQueryClient();
  
  // Get current submission to merge with new payload
  const current = await getSubmissionById(submissionId);
  if (!current) {
    throw new Error("Submission not found");
  }

  // Build updated payload - extract only form fields from current submission
  // Exclude metadata fields: Submission_ID, Status, Slack_TS, Slack_Channel, Approved_By, Employee_ID, Created_At, Updated_At
  const metadataFields = ["Submission_ID", "Status", "Slack_TS", "Slack_Channel", "Approved_By", "Employee_ID", "Created_At", "Updated_At"];
  const currentAny = current as unknown as Record<string, unknown>;
  
  // Start with current submission, remove metadata, then apply updates
  const updatedPayload: Record<string, unknown> = {};
  Object.keys(currentAny).forEach((key) => {
    if (!metadataFields.includes(key)) {
      updatedPayload[key] = currentAny[key];
    }
  });
  
  // Apply updates
  Object.assign(updatedPayload, payload);

  const query = `
    UPDATE ${intakeTableRef}
    SET
      Payload = TO_JSON(@payload),
      Updated_At = CURRENT_DATETIME()
    WHERE Submission_ID = @submissionId
  `;
  
  await bigquery.query({
    query,
    params: {
      submissionId,
      payload: updatedPayload,
    },
  });

  return await getSubmissionById(submissionId);
};

export const getNextEmployeeId = async () => {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT CAST(MAX(CAST(Employee_ID AS INT64)) + 1 AS INT64) AS nextId
    FROM ${employeeTableRef}
    WHERE Employee_ID IS NOT NULL
  `;
  const [rows] = await bigquery.query({ query });
  const nextId = rows[0]?.nextId;
  return nextId ? String(nextId) : "5000";
};

export const insertEmployeeFromSubmission = async (submission: OnboardingSubmission, employeeId: string) => {
  const bigquery = getBigQueryClient();
  const input = submission as unknown as OnboardingFormInput;
  
  // Sanitize phone numbers
  const contactNumber = input.Contact_Number ? input.Contact_Number.replace(/[^\d+]/g, "") : null;
  const emergencyContactNumber = input.Emergency_Contact_Number ? input.Emergency_Contact_Number.replace(/[^\d+]/g, "") : null;
  
  // Auto-calculate probation end date if joining date exists
  const probationEndDateCalc = input.Joining_Date 
    ? "DATE_ADD(CAST(@joiningDate AS DATE), INTERVAL 3 MONTH)"
    : "NULL";
  
  const employeeInsertQuery = `
    INSERT INTO ${employeeTableRef} (
      Employee_ID, Full_Name, CNIC_ID, Personal_Email, Official_Email,
      Contact_Number, Date_of_Birth, Gender, Temporary_Address, Permanent_Address,
      Nationality, LinkedIn_URL, Marital_Status, Age, Number_of_Children,
      Spouse_Name, Spouse_DOB, Joining_Date, Department, Designation,
      Reporting_Manager, Job_Type, Job_Location, Recruiter_Name, Preferred_Device,
      Employment_Location, Father_Name, Emergency_Contact_Number,
      Emergency_Contact_Relationship, Blood_Group, Degree_Transcript_URL,
      Last_Salary_Slip_URL, Experience_Letter_URL, Resume_URL, Passport_Photo_URL,
      CNIC_Front_URL, CNIC_Back_URL, Bank_Name, Bank_Account_Title,
      National_Tax_Number, Swift_Code_BIC, Bank_Account_Number_IBAN,
      Vehicle_Number, Introduction, Fun_Fact, Shirt_Size,
      Probation_Period_Months, Probation_Start_Date, Probation_End_Date,
      Lifecycle_Status, Timestamp, Email_Address,
      Created_At, Updated_At, Created_By, Is_Deleted
    )
    VALUES (
      @employeeId, @fullName, @cnicId, @personalEmail, @officialEmail,
      @contactNumber, @dateOfBirth, @gender, @currentAddress, @permanentAddress,
      @nationality, @linkedInUrl, @maritalStatus, @age, @numberOfChildren,
      @spouseName, @spouseDob, @joiningDate, @department, @designation,
      @reportingManager, @jobType, @jobLocation, @recruiterName, @preferredDevice,
      @employmentLocation, @fatherName, @emergencyContactNumber,
      @emergencyContactRelationship, @bloodGroup, @degreeTranscriptUrl,
      @lastSalarySlipUrl, @experienceLetterUrl, @resumeUrl, @passportPhotoUrl,
      @cnicFrontUrl, @cnicBackUrl, @bankName, @bankAccountTitle,
      @nationalTaxNumber, @swiftCodeBic, @bankAccountNumberIban,
      @vehicleNumber, @introduction, @funFact, @shirtSize,
      @probationPeriodMonths, @probationStartDate, ${probationEndDateCalc},
      'Active', CURRENT_TIMESTAMP(), @emailAddress,
      CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 'Slack Confirmation', FALSE
    )
  `;
  
  // Build params for BigQuery query
  const queryParams: Record<string, unknown> = {
    employeeId,
    fullName: input.Full_Name,
    cnicId: input.CNIC_ID,
    personalEmail: input.Personal_Email,
    officialEmail: input.Official_Email || null,
    contactNumber,
    dateOfBirth: input.Date_of_Birth || null,
    gender: input.Gender,
    currentAddress: input.Current_Address,
    permanentAddress: input.Permanent_Address,
    nationality: input.Nationality,
    linkedInUrl: input.LinkedIn_URL || null,
    maritalStatus: input.Marital_Status,
    age: input.Age ? parseInt(input.Age) : null,
    numberOfChildren: input.Number_of_Children ? parseInt(input.Number_of_Children) : null,
    spouseName: input.Spouse_Name || null,
    spouseDob: input.Spouse_DOB || null,
    joiningDate: input.Joining_Date || null,
    department: input.Department,
    designation: input.Designation,
    reportingManager: input.Reporting_Manager,
    jobType: input.Job_Type,
    jobLocation: input.Job_Location,
    recruiterName: input.Recruiter_Name,
    preferredDevice: input.Preferred_Device,
    employmentLocation: input.Employment_Location || null,
    fatherName: input.Father_Name,
    emergencyContactNumber,
    emergencyContactRelationship: input.Emergency_Contact_Relationship,
    bloodGroup: input.Blood_Group,
    degreeTranscriptUrl: input.Degree_Transcript_URL || null,
    lastSalarySlipUrl: input.Last_Salary_Slip_URL || null,
    experienceLetterUrl: input.Experience_Letter_URL || null,
    resumeUrl: input.Resume_URL || null,
    passportPhotoUrl: input.Passport_Photo_URL || null,
    cnicFrontUrl: input.CNIC_Front_URL || null,
    cnicBackUrl: input.CNIC_Back_URL || null,
    bankName: input.Bank_Name,
    bankAccountTitle: input.Bank_Account_Title,
    nationalTaxNumber: input.National_Tax_Number || null,
    swiftCodeBic: input.Swift_Code_BIC,
    bankAccountNumberIban: input.Bank_Account_Number_IBAN,
    vehicleNumber: input.Vehicle_Number || null,
    introduction: input.Introduction || null,
    funFact: input.Fun_Fact || null,
    shirtSize: input.Shirt_Size || null,
    probationPeriodMonths: input.Joining_Date ? 3 : null,
    probationStartDate: input.Joining_Date || null,
    emailAddress: input.Personal_Email || input.Official_Email || null,
  };

  // Specify types for parameters that can be null (required by BigQuery)
  const queryTypes: Record<string, string> = {
    officialEmail: "STRING",
    dateOfBirth: "DATE",
    linkedInUrl: "STRING",
    age: "INT64",
    numberOfChildren: "INT64",
    spouseName: "STRING",
    spouseDob: "DATE",
    joiningDate: "DATE",
    employmentLocation: "STRING",
    degreeTranscriptUrl: "STRING",
    lastSalarySlipUrl: "STRING",
    experienceLetterUrl: "STRING",
    resumeUrl: "STRING",
    passportPhotoUrl: "STRING",
    cnicFrontUrl: "STRING",
    cnicBackUrl: "STRING",
    nationalTaxNumber: "STRING",
    vehicleNumber: "STRING",
    introduction: "STRING",
    funFact: "STRING",
    shirtSize: "STRING",
    probationPeriodMonths: "INT64",
    probationStartDate: "DATE",
    emailAddress: "STRING",
  };

  await bigquery.query({
    query: employeeInsertQuery,
    params: queryParams,
    types: queryTypes,
  });

  // Create lifecycle event
  try {
    const lifecycleEventQuery = `
      INSERT INTO ${lifecycleEventsTableRef} 
        (Employee_ID, Lifecycle_Status, Event_Date, Event_By, Notes)
      VALUES (@employeeId, 'Active', CURRENT_TIMESTAMP(), 'Slack Confirmation', 'Employee onboarded via Slack confirmation')
    `;
    await bigquery.query({
      query: lifecycleEventQuery,
      params: { employeeId },
    });
  } catch (e) {
    // Lifecycle events table might not exist yet - that's OK
    console.warn("[ONBOARDING_LIFECYCLE_EVENT] Could not create lifecycle event:", e);
  }
};

export const notifySlackForSubmission = async ({
  submissionId,
  submission,
}: {
  submissionId: string;
  submission: OnboardingFormInput;
}) => {
  const joiningDateFormatted = formatDateWithDay(submission.Joining_Date);
  const summary = `New Employee Alert - Form Submitted
Name: ${submission.Full_Name}
Joining Date: ${joiningDateFormatted}
Email: ${submission.Official_Email}
Department: ${submission.Department}
Designation: ${submission.Designation}
Recruiter: ${submission.Recruiter_Name}
CNIC: ${submission.CNIC_ID}
Job Type: ${submission.Job_Type}
Reporting Manager: ${submission.Reporting_Manager}
Contact Number: ${submission.Contact_Number}`;
  
  const blockPayload = {
    channel: SLACK_NEW_JOINER_CHANNEL ?? "C06NPGT6EGM",
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

