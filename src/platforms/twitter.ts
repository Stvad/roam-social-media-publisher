import type { PostContent, PostResult } from "../types";
import type { ExtensionAPI } from "../types";
import { getCorsProxyUrl, processBlockText } from "../utils";
import OAuth from "oauth-1.0a";
import CryptoJS from "crypto-js";

const TWITTER_CHAR_LIMIT = 280;
const TWITTER_API_BASE = "https://api.x.com/2";

interface TwitterCreds {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function getCredentials(extensionAPI: ExtensionAPI): TwitterCreds | null {
  const apiKey = extensionAPI.settings.get("twitter-api-key") as string;
  const apiSecret = extensionAPI.settings.get("twitter-api-secret") as string;
  const accessToken = extensionAPI.settings.get("twitter-access-token") as string;
  const accessTokenSecret = extensionAPI.settings.get("twitter-access-token-secret") as string;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return null;
  return { apiKey, apiSecret, accessToken, accessTokenSecret };
}

function createOAuthHeader(
  creds: TwitterCreds,
  url: string,
  method: string
): string {
  const oauth = new OAuth({
    consumer: { key: creds.apiKey, secret: creds.apiSecret },
    signature_method: "HMAC-SHA1",
    hash_function(baseString: string, key: string) {
      return CryptoJS.HmacSHA1(baseString, key).toString(CryptoJS.enc.Base64);
    },
  });

  const token = { key: creds.accessToken, secret: creds.accessTokenSecret };
  const authHeader = oauth.toHeader(oauth.authorize({ url, method }, token));
  return authHeader.Authorization;
}

export function isTwitterConfigured(extensionAPI: ExtensionAPI): boolean {
  return getCredentials(extensionAPI) !== null;
}

export function validateTwitterThread(blocks: { text: string; uid: string }[]): {
  valid: boolean;
  errors: { uid: string; reason: string }[];
  counts: { uid: string; count: number }[];
} {
  const errors: { uid: string; reason: string }[] = [];
  const counts: { uid: string; count: number }[] = [];

  for (const block of blocks) {
    const { text } = processBlockText(block.text);
    const len = text.length;
    counts.push({ uid: block.uid, count: len });

    if (len === 0) {
      errors.push({ uid: block.uid, reason: "Tweet is empty" });
    } else if (len > TWITTER_CHAR_LIMIT) {
      errors.push({ uid: block.uid, reason: `Tweet is ${len - TWITTER_CHAR_LIMIT} chars over limit` });
    }
  }

  return { valid: errors.length === 0, errors, counts };
}

export async function postToTwitter(
  content: PostContent,
  extensionAPI: ExtensionAPI
): Promise<PostResult> {
  const creds = getCredentials(extensionAPI);
  if (!creds) {
    return { success: false, platform: "twitter", error: "Twitter credentials not configured" };
  }

  const corsProxy = getCorsProxyUrl();
  let inReplyToId: string | undefined;
  let firstTweetUrl: string | undefined;

  for (const block of content.blocks) {
    const { text } = processBlockText(block.text);
    const url = `${TWITTER_API_BASE}/tweets`;
    const body: Record<string, unknown> = { text };

    if (inReplyToId) {
      body.reply = { in_reply_to_tweet_id: inReplyToId };
    }

    const authorization = createOAuthHeader(creds, url, "POST");

    try {
      const response = await fetch(`${corsProxy}/${url}`, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData?.detail || errorData?.title || `HTTP ${response.status}`;
        return { success: false, platform: "twitter", error: errorMsg };
      }

      const data = await response.json();
      const tweetId = data.data?.id;
      inReplyToId = tweetId;

      if (!firstTweetUrl && tweetId) {
        firstTweetUrl = `https://x.com/i/web/status/${tweetId}`;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, platform: "twitter", error: msg };
    }
  }

  return { success: true, platform: "twitter", url: firstTweetUrl };
}

export const TWITTER_CHAR_MAX = TWITTER_CHAR_LIMIT;
