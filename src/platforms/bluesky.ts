import type { PostContent, PostResult } from "../types";
import type { ExtensionAPI } from "../types";
import { getCorsProxyUrl, resolveBlockText } from "../utils";

const BLUESKY_CHAR_LIMIT = 300;
const BSKY_API_BASE = "https://bsky.social/xrpc";

interface BlueskySession {
  accessJwt: string;
  did: string;
}

function getCredentials(extensionAPI: ExtensionAPI): { handle: string; appPassword: string } | null {
  const handle = extensionAPI.settings.get("bluesky-handle") as string;
  const appPassword = extensionAPI.settings.get("bluesky-app-password") as string;
  if (!handle || !appPassword) return null;
  return { handle, appPassword };
}

async function createSession(handle: string, appPassword: string): Promise<BlueskySession> {
  const corsProxy = getCorsProxyUrl();
  const url = `${BSKY_API_BASE}/com.atproto.server.createSession`;

  const response = await fetch(`${corsProxy}/${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.message || `Bluesky auth failed: ${response.status}`);
  }

  const data = await response.json();
  return { accessJwt: data.accessJwt, did: data.did };
}

// Detect mentions (@handle.bsky.social) and URLs, return facets array
function detectFacets(text: string): Array<{
  index: { byteStart: number; byteEnd: number };
  features: Array<Record<string, unknown>>;
}> {
  const encoder = new TextEncoder();
  const facets: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<Record<string, unknown>>;
  }> = [];

  // Detect URLs
  const urlRegex = /https?:\/\/[^\s)>\]]+/g;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    const beforeBytes = encoder.encode(text.slice(0, match.index)).byteLength;
    const matchBytes = encoder.encode(match[0]).byteLength;
    facets.push({
      index: { byteStart: beforeBytes, byteEnd: beforeBytes + matchBytes },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: match[0] }],
    });
  }

  // Detect mentions
  const mentionRegex = /@([a-zA-Z0-9._-]+(?:\.[a-zA-Z0-9._-]+)*)/g;
  while ((match = mentionRegex.exec(text)) !== null) {
    const handle = match[1];
    if (handle.includes(".")) {
      const beforeBytes = encoder.encode(text.slice(0, match.index)).byteLength;
      const matchBytes = encoder.encode(match[0]).byteLength;
      facets.push({
        index: { byteStart: beforeBytes, byteEnd: beforeBytes + matchBytes },
        features: [{ $type: "app.bsky.richtext.facet#mention", did: handle }],
      });
    }
  }

  return facets;
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
    const text = resolveBlockText(block.text);
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

export async function postToBluesky(
  content: PostContent,
  extensionAPI: ExtensionAPI
): Promise<PostResult> {
  const creds = getCredentials(extensionAPI);
  if (!creds) {
    return { success: false, platform: "bluesky", error: "Bluesky credentials not configured" };
  }

  let session: BlueskySession;
  try {
    session = await createSession(creds.handle, creds.appPassword);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, platform: "bluesky", error: msg };
  }

  const corsProxy = getCorsProxyUrl();
  let rootRef: { uri: string; cid: string } | undefined;
  let parentRef: { uri: string; cid: string } | undefined;
  let firstPostUri: string | undefined;

  for (const block of content.blocks) {
    const text = resolveBlockText(block.text);
    const facets = detectFacets(text);

    const record: Record<string, unknown> = {
      $type: "app.bsky.feed.post",
      text,
      createdAt: new Date().toISOString(),
    };

    if (facets.length > 0) {
      record.facets = facets;
    }

    if (parentRef && rootRef) {
      record.reply = { root: rootRef, parent: parentRef };
    }

    const url = `${BSKY_API_BASE}/com.atproto.repo.createRecord`;

    try {
      const response = await fetch(`${corsProxy}/${url}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: session.did,
          collection: "app.bsky.feed.post",
          record,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return {
          success: false,
          platform: "bluesky",
          error: errData?.message || `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      const ref = { uri: data.uri, cid: data.cid };

      if (!rootRef) {
        rootRef = ref;
        // Convert AT URI to web URL
        // at://did:plc:xxx/app.bsky.feed.post/rkey -> https://bsky.app/profile/handle/post/rkey
        const rkey = data.uri.split("/").pop();
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
