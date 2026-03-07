import type { PostContent, PostResult } from "../types";
import type { ExtensionAPI } from "../types";
import { processBlockText } from "../utils";

const TWITTER_CHAR_LIMIT = 280;
const BUFFER_API_URL = "https://api.buffer.com";

function getCredentials(extensionAPI: ExtensionAPI): { apiToken: string; channelId: string } | null {
  const apiToken = extensionAPI.settings.get("buffer-api-token") as string;
  const channelId = extensionAPI.settings.get("buffer-twitter-channel-id") as string;
  if (!apiToken || !channelId) return null;
  return { apiToken, channelId };
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

async function bufferGraphQL(
  apiToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<any> {
  const response = await fetch(BUFFER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Buffer API HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.errors?.length) {
    throw new Error(result.errors.map((e: { message: string }) => e.message).join(", "));
  }
  return result.data;
}

export async function postToTwitter(
  content: PostContent,
  extensionAPI: ExtensionAPI
): Promise<PostResult> {
  const creds = getCredentials(extensionAPI);
  if (!creds) {
    return { success: false, platform: "twitter", error: "Buffer credentials not configured for Twitter" };
  }

  // Buffer doesn't natively support threads as a single operation,
  // so we post each block as a separate post via Buffer.
  // For single tweets this is straightforward; for threads,
  // each block becomes its own scheduled post.
  const texts = content.blocks.map((b) => processBlockText(b.text).text).filter(Boolean);
  if (texts.length === 0) {
    return { success: false, platform: "twitter", error: "No content to post" };
  }

  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            status
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  try {
    // Post the first block (or all blocks joined if it's a thread we can't split)
    // For threads: post each block separately via Buffer
    for (let i = 0; i < texts.length; i++) {
      const variables = {
        input: {
          text: texts[i],
          channelId: creds.channelId,
          schedulingType: "automatic",
          mode: "shareNow",
        },
      };

      const data = await bufferGraphQL(creds.apiToken, mutation, variables);
      const result = data.createPost;

      if (result.message) {
        return { success: false, platform: "twitter", error: result.message };
      }
    }

    return { success: true, platform: "twitter" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, platform: "twitter", error: msg };
  }
}

export const TWITTER_CHAR_MAX = TWITTER_CHAR_LIMIT;
