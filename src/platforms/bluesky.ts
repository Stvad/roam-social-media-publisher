import { AtpAgent, RichText } from "@atproto/api";
import type { PostContent, PostResult } from "../types";
import type { ExtensionAPI } from "../types";
import { getCorsProxyUrl, processBlockText } from "../utils";

const BLUESKY_CHAR_LIMIT = 300;

function getCredentials(extensionAPI: ExtensionAPI): { handle: string; appPassword: string } | null {
  const handle = extensionAPI.settings.get("bluesky-handle") as string;
  const appPassword = extensionAPI.settings.get("bluesky-app-password") as string;
  if (!handle || !appPassword) return null;
  return { handle, appPassword };
}

export function isBlueskyConfigured(extensionAPI: ExtensionAPI): boolean {
  return getCredentials(extensionAPI) !== null;
}

export function validateBlueskyThread(blocks: { text: string; uid: string }[]): {
  valid: boolean;
  errors: { uid: string; reason: string }[];
  counts: { uid: string; count: number }[];
} {
  const errors: { uid: string; reason: string }[] = [];
  const counts: { uid: string; count: number }[] = [];

  for (const block of blocks) {
    const { text } = processBlockText(block.text);
    // Bluesky counts graphemes
    const len = [...text].length;
    counts.push({ uid: block.uid, count: len });

    if (len === 0) {
      errors.push({ uid: block.uid, reason: "Post is empty" });
    } else if (len > BLUESKY_CHAR_LIMIT) {
      errors.push({ uid: block.uid, reason: `Post is ${len - BLUESKY_CHAR_LIMIT} chars over limit` });
    }
  }

  return { valid: errors.length === 0, errors, counts };
}

async function fetchImageAsBlob(url: string): Promise<Blob> {
  const corsProxy = getCorsProxyUrl();
  const fetchUrl = corsProxy ? `${corsProxy}/${url}` : url;
  const response = await fetch(fetchUrl);
  return response.blob();
}

async function uploadImages(
  mediaUrls: string[],
  agent: AtpAgent
): Promise<{ $type: string; images: Array<{ alt: string; image: unknown }> } | null> {
  if (!mediaUrls.length) return null;

  const uploadedImages = await Promise.all(
    mediaUrls.slice(0, 4).map(async (url) => {
      const blob = await fetchImageAsBlob(url);
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const { data: uploadData } = await agent.uploadBlob(uint8Array, {
        encoding: blob.type || "image/jpeg",
      });

      if (!uploadData?.blob) {
        throw new Error("Failed to upload image: no blob reference returned");
      }

      return {
        alt: "Image from Roam Research",
        image: uploadData.blob,
      };
    })
  );

  return {
    $type: "app.bsky.embed.images",
    images: uploadedImages,
  };
}

export async function postToBluesky(
  content: PostContent,
  extensionAPI: ExtensionAPI
): Promise<PostResult> {
  const creds = getCredentials(extensionAPI);
  if (!creds) {
    return { success: false, platform: "bluesky", error: "Bluesky credentials not configured" };
  }

  const agent = new AtpAgent({ service: "https://bsky.social" });

  try {
    await agent.login({ identifier: creds.handle, password: creds.appPassword });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, platform: "bluesky", error: msg };
  }

  let rootRef: { uri: string; cid: string } | undefined;
  let parentRef: { uri: string; cid: string } | undefined;
  let firstPostUri: string | undefined;

  for (const block of content.blocks) {
    const { text, mediaUrls } = processBlockText(block.text);

    // Skip empty blocks with no media
    if (!text && !mediaUrls.length) continue;

    // Use RichText for proper facet detection (links, mentions, hashtags)
    const rt = new RichText({ text });
    await rt.detectFacets(agent);

    const record: any = {
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
    };

    // Thread: set reply references
    if (parentRef && rootRef) {
      record.reply = { root: rootRef, parent: parentRef };
    }

    // Upload and embed images
    if (mediaUrls.length > 0) {
      try {
        const embed = await uploadImages(mediaUrls, agent);
        if (embed) record.embed = embed;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, platform: "bluesky", error: `Image upload failed: ${msg}` };
      }
    }

    try {
      const response = await agent.api.app.bsky.feed.post.create(
        { repo: agent.session!.did },
        record as any
      );

      const ref = { uri: response.uri, cid: response.cid };

      if (!rootRef) {
        rootRef = ref;
        const rkey = response.uri.split("/").pop();
        firstPostUri = `https://bsky.app/profile/${creds.handle}/post/${rkey}`;
      }
      parentRef = ref;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, platform: "bluesky", error: msg };
    }
  }

  return { success: true, platform: "bluesky", url: firstPostUri };
}

export const BLUESKY_CHAR_MAX = BLUESKY_CHAR_LIMIT;
