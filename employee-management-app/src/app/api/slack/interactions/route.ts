import { NextResponse } from "next/server";
import {
  getSubmissionById,
  insertEmployeeFromSubmission,
  updateSubmissionMeta,
  getNextEmployeeId,
  updateEmploymentEndDate,
} from "@/lib/onboarding";
import { verifySlackSignature, ALLOWED_SLACK_USERS } from "@/lib/slack";
import { postSlackMessage } from "@/lib/slack";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    const valid = await verifySlackSignature(rawBody, request.headers);
    if (!valid) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    }

    const payload = new URLSearchParams(rawBody.toString()).get("payload");
    if (!payload) {
      return NextResponse.json({ message: "Missing payload" }, { status: 400 });
    }
    const parsed = JSON.parse(payload);
    const action = parsed.actions?.[0];
    const userId = parsed.user?.id;
    const channelId = parsed.channel?.id ?? parsed.container?.channel_id;
    const threadTs = parsed.message?.ts ?? parsed.container?.thread_ts;

    if (!action || !userId || !channelId || !threadTs) {
      return NextResponse.json({ message: "Malformed payload" }, { status: 400 });
    }

    if (!ALLOWED_SLACK_USERS.includes(userId)) {
      return NextResponse.json({ message: "Unauthorized user" }, { status: 403 });
    }

    const actionValue = JSON.parse(action.value);
    const submissionId = actionValue.submissionId;
    const submission = submissionId ? await getSubmissionById(submissionId) : null;
    if (!submission) {
      return NextResponse.json({ message: "Submission not found" }, { status: 404 });
    }

    if (actionValue.action === "onboard") {
      const nextId = await getNextEmployeeId();
      await insertEmployeeFromSubmission(submission, nextId);
      await updateEmploymentEndDate(nextId, submission.Joining_Date);
      await updateSubmissionMeta(submissionId, {
        status: "confirmed",
        approvedBy: userId,
        employeeId: nextId,
      });

      const docMessage = `📋 *Documents for ${submission.Full_Name}*\n\n🖼️ Passport Photo:\n${submission.Passport_Photo_URL ?? "Not provided"}\n\n🪪 CNIC Front:\n${submission.CNIC_Front_URL ?? "Not provided"}\n\n🪪 CNIC Back:\n${submission.CNIC_Back_URL ?? "Not provided"}`;
      await postSlackMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: docMessage,
      });

      await postSlackMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: `✅ Onboarding confirmed by <@${userId}>. Assigned Employee ID: ${nextId}`,
      });
      return NextResponse.json({ ok: true });
    }

    if (actionValue.action === "cancel") {
      await updateSubmissionMeta(submissionId, {
        status: "cancelled",
        approvedBy: userId,
      });
      await postSlackMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: `❌ Submission cancelled by <@${userId}>`,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ message: "Unhandled action" }, { status: 400 });
  } catch (error) {
    console.error("[SLACK_INTERACTIONS_ERROR]", error);
    return NextResponse.json({ message: "Slack interaction failed" }, { status: 500 });
  }
}

