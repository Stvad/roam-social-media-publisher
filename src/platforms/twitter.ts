import type { PostContent, PostResult } from "../types";
import type { ExtensionAPI } from "../types";
import { getCorsProxyUrl, processBlockText } from "../utils";

const TWITTER_CHAR_LIMIT = 280;
const BUFFER_API_URL = "https://api.buffer.com";

// Cache the resolved channel ID so we only look it up once per session
let cachedChannelId: string | null = null;

function getApiToken(extensionAPI: ExtensionAPI): string | null {
  const apiToken = extensionAPI.settings.get("buffer-api-token") as string;
  return apiToken || null;
}

export function isTwitterConfigured(extensionAPI: ExtensionAPI): boolean {
  return getApiToken(extensionAPI) !== null;
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
  const corsProxy = getCorsProxyUrl();
  const url = corsProxy ? `${corsProxy}/${BUFFER_API_URL}` : BUFFER_API_URL;

  const response = await fetch(url, {
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

async function resolveTwitterChannelId(apiToken: string): Promise<string> {
  if (cachedChannelId) return cachedChannelId;

  // Step 1: Get organization ID
  const orgData = await bufferGraphQL(apiToken, `{ account { organizations { id } } }`);
  const orgs = orgData.account?.organizations;
  if (!orgs?.length) throw new Error("No Buffer organizations found");

  // Step 2: Get channels for the org, find the Twitter one
  const channelData = await bufferGraphQL(
    apiToken,
    `query GetChannels($input: ChannelsInput!) { channels(input: $input) { id name service } }`,
    { input: { organizationId: orgs[0].id } }
  );

  const twitterChannel = channelData.channels?.find(
    (c: { service: string }) => c.service === "twitter"
  );
  if (!twitterChannel) {
    throw new Error("No Twitter/X channel found in your Buffer account. Connect one at buffer.com first.");
  }

  cachedChannelId = twitterChannel.id;
  return twitterChannel.id;
}

export async function postToTwitter(
  content: PostContent,
  extensionAPI: ExtensionAPI
): Promise<PostResult> {
  const apiToken = getApiToken(extensionAPI);
  if (!apiToken) {
    return { success: false, platform: "twitter", error: "Buffer API token not configured" };
  }

  let channelId: string;
  try {
    channelId = await resolveTwitterChannelId(apiToken);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, platform: "twitter", error: msg };
  }

  const processed = content.blocks.map((b) => processBlockText(b.text));
  const hasContent = processed.some((p) => p.text || p.mediaUrls.length);
  if (!hasContent) {
    return { success: false, platform: "twitter", error: "No content to post" };
  }

  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            status
            externalLink
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  try {
    const firstBlock = processed[0];
    const threadBlocks = processed.slice(1).filter((b) => b.text || b.mediaUrls.length);

    function buildAssets(mediaUrls: string[]) {
      if (mediaUrls.length === 0) return undefined;
      return {
        images: mediaUrls.slice(0, 4).map((url) => ({
          url,
          metadata: { altText: "Image from Roam Research" },
        })),
      };
    }

    const input: Record<string, unknown> = {
      text: firstBlock.text,
      channelId,
      schedulingType: "automatic",
      mode: "shareNow",
    };

    const firstAssets = buildAssets(firstBlock.mediaUrls);
    if (firstAssets) input.assets = firstAssets;

    // Use Buffer's native thread support for multi-block threads
    // Put ALL blocks (including first) in the thread array; leave main text
    // as the first block so Buffer shows it as the thread header
    if (threadBlocks.length > 0) {
      const allThreadItems = processed
        .filter((b) => b.text || b.mediaUrls.length)
        .map((b) => {
          const item: Record<string, unknown> = { text: b.text };
          const assets = buildAssets(b.mediaUrls);
          if (assets) item.assets = assets;
          return item;
        });

      input.metadata = {
        twitter: {
          thread: allThreadItems,
        },
      };
    }

    const data = await bufferGraphQL(apiToken, mutation, { input });
    const result = data.createPost;

    if (result.message) {
      return { success: false, platform: "twitter", error: result.message };
    }

    const externalLink = result.post?.externalLink || undefined;
    return { success: true, platform: "twitter", url: externalLink };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, platform: "twitter", error: msg };
  }
}

export const TWITTER_CHAR_MAX = TWITTER_CHAR_LIMIT;
