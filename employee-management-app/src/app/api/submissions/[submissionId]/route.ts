import { NextResponse } from "next/server";
import { getSubmissionById, updateSubmissionPayload } from "@/lib/onboarding";
import type { OnboardingFormInput } from "@/types/onboarding";
import { uploadOnboardingFile, SUBFOLDER_NAMES } from "@/lib/google-drive";

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
    const contentType = request.headers.get("content-type") ?? "";
    const isMultipart = contentType.includes("multipart/form-data");

    let body: Partial<OnboardingFormInput>;

    if (isMultipart) {
      const formData = await request.formData();
      const updates: Record<string, unknown> = {};
      const fileFieldNames = Object.keys(SUBFOLDER_NAMES) as (keyof typeof SUBFOLDER_NAMES)[];

      for (const [key, value] of formData.entries()) {
        if (value == null) continue;

        if (value instanceof File) {
          if (value.size === 0) continue;
          if (!fileFieldNames.includes(key as keyof typeof SUBFOLDER_NAMES)) continue;

          const buffer = Buffer.from(await value.arrayBuffer());
          const url = await uploadOnboardingFile(key as keyof typeof SUBFOLDER_NAMES, {
            buffer,
            mimeType: value.type || "application/octet-stream",
            originalName: value.name || key,
          });
          if (url) updates[key] = url;
          continue;
        }

        const str = String(value);
        if (str.trim().length === 0) continue;
        updates[key] = str;
      }

      body = updates as unknown as Partial<OnboardingFormInput>;
    } else {
      body = await request.json();
    }

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

