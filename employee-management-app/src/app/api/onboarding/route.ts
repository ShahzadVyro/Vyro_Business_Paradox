import { NextResponse } from "next/server";
import { createOnboardingSubmission, listOnboardingSubmissions, notifySlackForSubmission } from "@/lib/onboarding";
import { uploadOnboardingFile, SUBFOLDER_NAMES } from "@/lib/google-drive";
import type { OnboardingFormInput } from "@/types/onboarding";

const requiredFields = [
  "Full_Name",
  "CNIC_ID",
  "Personal_Email",
  "Official_Email",
  "Contact_Number",
  "Date_of_Birth",
  "Gender",
  "Current_Address",
  "Permanent_Address",
  "Nationality",
  "Marital_Status",
  "Joining_Date",
  "Department",
  "Designation",
  "Reporting_Manager",
  "Job_Type",
  "Job_Location",
  "Recruiter_Name",
  "Preferred_Device",
  "Father_Name",
  "Emergency_Contact_Number",
  "Emergency_Contact_Relationship",
  "Blood_Group",
  "Bank_Name",
  "Bank_Account_Title",
  "Bank_Account_Number_IBAN",
  "Swift_Code_BIC",
  "Introduction",
  "Fun_Fact",
  "Shirt_Size",
  "Resume_URL",
];

const fileFieldNames = Object.keys(SUBFOLDER_NAMES) as (keyof typeof SUBFOLDER_NAMES)[];

/** All form field names (text + file) for building payload from FormData */
const allFormFieldNames = [
  ...requiredFields,
  "LinkedIn_URL",
  "Age",
  "Number_of_Children",
  "Spouse_Name",
  "Spouse_DOB",
  "Employment_Location",
  "National_Tax_Number",
  "Vehicle_Number",
  ...fileFieldNames,
];

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const submissions = await listOnboardingSubmissions(status || undefined);
    return NextResponse.json({ submissions });
  } catch (error) {
    console.error("[ONBOARDING_LIST_ERROR]", error);
    return NextResponse.json({ message: "Failed to load submissions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const isMultipart = contentType.includes("multipart/form-data");

    let body: Record<string, string>;

    if (isMultipart) {
      const formData = await request.formData();
      body = {} as Record<string, string>;

      for (const name of allFormFieldNames) {
        const value = formData.get(name);
        if (value == null) {
          body[name] = "";
          continue;
        }
        if (value instanceof File) {
          if (value.size === 0) {
            body[name] = "";
            continue;
          }
          const buffer = Buffer.from(await value.arrayBuffer());
          const url = await uploadOnboardingFile(name as keyof typeof SUBFOLDER_NAMES, {
            buffer,
            mimeType: value.type || "application/octet-stream",
            originalName: value.name || name,
          });
          body[name] = url ?? "";
          continue;
        }
        body[name] = String(value);
      }
    } else {
      body = await request.json();
    }

    for (const field of requiredFields) {
      if (!body[field] || typeof body[field] !== "string" || body[field].trim().length === 0) {
        return NextResponse.json({ message: `${field} is required` }, { status: 400 });
      }
    }

    const { submissionId, payload } = await createOnboardingSubmission(body as unknown as OnboardingFormInput);
    await notifySlackForSubmission({ submissionId, submission: payload });

    return NextResponse.json({ success: true, submissionId });
  } catch (error) {
    console.error("[ONBOARDING_CREATE_ERROR]", error);
    const details =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error";
    return NextResponse.json({ message: "Failed to submit onboarding form", details }, { status: 500 });
  }
}

