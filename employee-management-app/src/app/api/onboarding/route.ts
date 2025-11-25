import { NextResponse } from "next/server";
import { createOnboardingSubmission, listOnboardingSubmissions, notifySlackForSubmission } from "@/lib/onboarding";

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
];

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
    const body = await request.json();
    for (const field of requiredFields) {
      if (!body[field] || typeof body[field] !== "string" || body[field].trim().length === 0) {
        return NextResponse.json({ message: `${field} is required` }, { status: 400 });
      }
    }

    const { submissionId, payload } = await createOnboardingSubmission(body);
    await notifySlackForSubmission({ submissionId, submission: payload });

    return NextResponse.json({ success: true, submissionId });
  } catch (error) {
    console.error("[ONBOARDING_CREATE_ERROR]", error);
    return NextResponse.json({ message: "Failed to submit onboarding form" }, { status: 500 });
  }
}

