import { NextResponse } from "next/server";
import { getSubmissionById, updateSubmissionPayload } from "@/lib/onboarding";
import type { OnboardingFormInput } from "@/types/onboarding";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return NextResponse.json({ message: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error("[SUBMISSION_GET_ERROR]", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to fetch submission" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;
    const body: Partial<OnboardingFormInput> = await request.json();

    // Validate submission exists
    const existing = await getSubmissionById(submissionId);
    if (!existing) {
      return NextResponse.json({ message: "Submission not found" }, { status: 404 });
    }

    // Update submission payload
    const updated = await updateSubmissionPayload(submissionId, body);

    return NextResponse.json({
      success: true,
      message: "Submission updated successfully",
      submission: updated,
    });
  } catch (error) {
    console.error("[SUBMISSION_UPDATE_ERROR]", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update submission" },
      { status: 500 }
    );
  }
}
