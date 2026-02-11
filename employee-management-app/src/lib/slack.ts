import crypto from "crypto";
import axios from "axios";
import { getEnv, getEnvArray } from "@/lib/env";

const SLACK_BOT_TOKEN = getEnv("SLACK_BOT_TOKEN")?.trim();
const SLACK_SIGNING_SECRET = getEnv("SLACK_SIGNING_SECRET")?.trim();

export const SLACK_CHANNEL_ID = getEnv("SLACK_CHANNEL_ID") ?? "C06NPGT6EGM";
const allowedUsersEnv = getEnvArray("SLACK_ALLOWED_USERS");
const allowedFallback = allowedUsersEnv.length ? allowedUsersEnv : getEnvArray("ALLOWED_USERS");
export const ALLOWED_SLACK_USERS = allowedFallback.map((entry) => entry.trim()).filter(Boolean);

const slackConfigured = Boolean(SLACK_BOT_TOKEN);

if (!slackConfigured) {
  console.warn("[SLACK_DISABLED] SLACK_BOT_TOKEN missing. Slack notifications will be skipped.");
}

const slackClient = slackConfigured
  ? axios.create({
      baseURL: "https://slack.com/api",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      timeout: 10000,
    })
  : null;

export interface SlackMessageRequest {
  channel: string;
  text: string;
  blocks?: unknown[];
  thread_ts?: string;
}

export type SlackPostResult = { ok: boolean; ts: string; channel: string } | null;

export const postSlackMessage = async (payload: SlackMessageRequest): Promise<SlackPostResult> => {
  if (!slackClient) {
    console.warn("[SLACK_DISABLED] Attempted to post Slack message without configuration.", payload);
    return null;
  }
  const { data } = await slackClient.post("/chat.postMessage", payload);
  if (!data.ok) {
    throw new Error(`Slack error: ${data.error}`);
  }
  return data as { ok: boolean; ts: string; channel: string };
};

export const getSlackUserInfo = async (userId: string): Promise<{ name: string; real_name?: string } | null> => {
  if (!slackClient) {
    return null;
  }
  try {
    const { data } = await slackClient.get(`/users.info?user=${userId}`);
    if (data.ok && data.user) {
      return {
        name: data.user.name || userId,
        real_name: data.user.real_name || data.user.profile?.real_name,
      };
    }
    return null;
  } catch (error) {
    console.warn("[SLACK_USER_INFO_ERROR]", error);
    return null;
  }
};

export const verifySlackSignature = async (rawBody: Buffer, headers: Headers) => {
  if (!SLACK_SIGNING_SECRET) {
    // Only allow unsigned requests in non-production environments.
    if (process.env.NODE_ENV !== "production") return true;
    console.warn("[SLACK_SIGNATURE_INVALID] SLACK_SIGNING_SECRET is not set");
    return false;
  }
  const timestamp = headers.get("x-slack-request-timestamp")?.trim();
  const signature = headers.get("x-slack-signature")?.trim();
  if (!timestamp || !signature) {
    console.warn("[SLACK_SIGNATURE_INVALID] Missing Slack signature headers");
    return false;
  }

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (Number(timestamp) < fiveMinutesAgo) {
    console.warn("[SLACK_SIGNATURE_INVALID] Slack timestamp too old");
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody.toString()}`;
  const hmac = crypto.createHmac("sha256", SLACK_SIGNING_SECRET);
  hmac.update(baseString);
  const computedSignature = `v0=${hmac.digest("hex")}`;
  if (computedSignature.length !== signature.length) {
    console.warn("[SLACK_SIGNATURE_INVALID] Signature length mismatch");
    return false;
  }
  const ok = crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signature));
  if (!ok) {
    console.warn("[SLACK_SIGNATURE_INVALID] Signature mismatch");
  }
  return ok;
};

