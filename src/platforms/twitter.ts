import type { PostContent, PostResult } from "../types";
import type { ExtensionAPI } from "../types";
import { getCorsProxyUrl, processBlockText } from "../utils";
import OAuth from "oauth-1.0a";
import CryptoJS from "crypto-js";

const TWITTER_CHAR_LIMIT = 280;
// Use api.twitter.com — api.x.com may return 503 for some endpoints
const TWITTER_API_BASE = "https://api.twitter.com/2";

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
    const proxyUrl = `${corsProxy}/${url}`;

    try {
      // Retry loop: Twitter v2 POST /tweets returns intermittent 503s
      let response: Response | undefined;
      let responseText = "";
      const MAX_RETRIES = 3;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const authorization = createOAuthHeader(creds, url, "POST");
        response = await fetch(proxyUrl, {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        responseText = await response.text();

        if (response.status !== 503 || attempt === MAX_RETRIES) break;
        // Wait before retry: 1s, 2s
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }

      if (!response!.ok) {
        let errorMsg = `HTTP ${response!.status}: ${response!.statusText}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMsg = errorData?.detail || errorData?.title || errorData?.errors?.[0]?.message || errorMsg;
        } catch {}
        return { success: false, platform: "twitter", error: errorMsg };
      }

      const data = JSON.parse(responseText);
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
