import { NextResponse } from "next/server";
import {
  getSubmissionById,
  insertEmployeeFromSubmission,
  updateSubmissionMeta,
  getNextEmployeeId,
} from "@/lib/onboarding";
import { updateEmploymentEndDate } from "@/lib/employees";
import { verifySlackSignature, ALLOWED_SLACK_USERS, postSlackMessage, getSlackUserInfo } from "@/lib/slack";
import { formatDateWithDay } from "@/lib/formatters";

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

      // Get user info for display name
      const userInfo = await getSlackUserInfo(userId);
      const userName = userInfo?.real_name || userInfo?.name || `<@${userId}>`;

      // Format joining date
      const joiningDateFormatted = formatDateWithDay(submission.Joining_Date);

      // Format current time (H:MM in Asia/Karachi, 12-hour format)
      const now = new Date();
      const timeFormatter = new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Karachi",
        hour12: true,
      });
      const currentTime = timeFormatter.format(now);

      // Helper to convert Google Drive URLs to download format
      const formatDriveUrl = (url: string | null | undefined): string => {
        if (!url) return "Not provided";
        // Check if it's a Google Drive URL
        const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
          return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
        }
        return url;
      };

      // Format documents message
      const docMessage = `:clipboard: Documents for ${submission.Full_Name}
:date: Joining Date: ${joiningDateFormatted}
:frame_with_picture: Passport Photo:
${formatDriveUrl(submission.Passport_Photo_URL)}
:identification_card: CNIC Front:
${formatDriveUrl(submission.CNIC_Front_URL)}
:identification_card: CNIC Back:
${formatDriveUrl(submission.CNIC_Back_URL)}
${currentTime}
ONBOARD confirmed by ${userName}`;

      await postSlackMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: docMessage,
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

