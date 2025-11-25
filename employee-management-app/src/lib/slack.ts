import crypto from "crypto";
import axios from "axios";
import { getEnv, getEnvArray } from "@/lib/env";

const SLACK_BOT_TOKEN = getEnv("SLACK_BOT_TOKEN");
const SLACK_SIGNING_SECRET = getEnv("SLACK_SIGNING_SECRET");

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

export const verifySlackSignature = async (rawBody: Buffer, headers: Headers) => {
  if (!SLACK_SIGNING_SECRET) return true; // fallback for local dev
  const timestamp = headers.get("x-slack-request-timestamp");
  const signature = headers.get("x-slack-signature");
  if (!timestamp || !signature) return false;

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (Number(timestamp) < fiveMinutesAgo) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody.toString()}`;
  const hmac = crypto.createHmac("sha256", SLACK_SIGNING_SECRET);
  hmac.update(baseString);
  const computedSignature = `v0=${hmac.digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signature));
};

