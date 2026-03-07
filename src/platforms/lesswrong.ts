import type { PostContent, PostResult } from "../types";
import type { ExtensionAPI } from "../types";
import { getCorsProxyUrl } from "../utils";

const LW_GRAPHQL_URL = "https://www.lesswrong.com/graphql";

const BLOCK_REF_REGEX = /\(\(([\w\d-]{9,10})\)\)/g;
const PAGE_REF_REGEX = /\[\[([^\]]+)\]\]/g;
const HASHTAG_PAGE_REF_REGEX = /#\[\[([^\]]+)\]\]/g;
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^\s)]*)\)/g;
const ALIAS_REGEX = /\[([^\]]*)\]\(([^)]+)\)/g;
const BUTTON_REGEX = /\{\{[^}]*\}\}/g;

declare const window: Window & { roamAlphaAPI: any };

function getCredentials(extensionAPI: ExtensionAPI): { loginToken: string } | null {
  const loginToken = extensionAPI.settings.get("lesswrong-login-token") as string;
  if (!loginToken) return null;
  return { loginToken };
}

// Convert Roam block text to HTML for LessWrong, preserving rich formatting
function blockToHtml(raw: string): string {
  if (!raw) return "";

  let text = raw;

  // Remove images (will be handled separately later)
  text = text.replace(IMAGE_REGEX, "");

  // Resolve block references
  text = text.replace(BLOCK_REF_REGEX, (_, uid) => {
    try {
      const result = window.roamAlphaAPI.data.pull(
        "[:block/string]",
        [":block/uid", uid]
      );
      return result?.[":block/string"] || "";
    } catch {
      return "";
    }
  });

  // Remove button syntax
  text = text.replace(BUTTON_REGEX, "");

  // HTML-escape the text
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Convert Roam/markdown formatting to HTML
  // Alias links [text](url) -> <a href="url">text</a>
  text = text.replace(ALIAS_REGEX, '<a href="$2">$1</a>');

  // #[[Page Ref]] -> linked text
  text = text.replace(HASHTAG_PAGE_REF_REGEX, (_, pageName) => pageName);

  // [[Page Ref]] -> plain text
  text = text.replace(PAGE_REF_REGEX, (_, pageName) => pageName);

  // Bold **text** -> <strong>
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic __text__ -> <em>
  text = text.replace(/__(.+?)__/g, "<em>$1</em>");

  // Highlight ^^text^^ -> <mark> (LW supports this)
  text = text.replace(/\^\^(.+?)\^\^/g, "<mark>$1</mark>");

  // Strikethrough ~~text~~ -> <del>
  text = text.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Inline code `text` -> <code>
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // URLs that aren't already in <a> tags
  text = text.replace(
    /(?<!href=")(https?:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>'
  );

  return text.trim();
}

function blocksToHtml(blocks: { text: string }[]): string {
  return blocks
    .map((b) => `<p>${blockToHtml(b.text)}</p>`)
    .join("\n");
}

export function isLessWrongConfigured(extensionAPI: ExtensionAPI): boolean {
  return getCredentials(extensionAPI) !== null;
}

export async function postToLessWrong(
  content: PostContent,
  extensionAPI: ExtensionAPI
): Promise<PostResult> {
  const creds = getCredentials(extensionAPI);
  if (!creds) {
    return { success: false, platform: "lesswrong", error: "LessWrong login token not configured" };
  }

  const corsProxy = getCorsProxyUrl();
  const html = blocksToHtml(content.blocks);

  const mutation = `
    mutation CreateComment($data: CreateCommentDataInput!) {
      createComment(data: $data) {
        data {
          _id
          postId
          user {
            slug
          }
        }
      }
    }
  `;

  const variables = {
    data: {
      shortform: true,
      shortformFrontpage: true,
      contents: {
        originalContents: {
          type: "html",
          data: html,
        },
      },
    },
  };

  try {
    const response = await fetch(`${corsProxy}/${LW_GRAPHQL_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        loginToken: creds.loginToken,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    if (!response.ok) {
      return {
        success: false,
        platform: "lesswrong",
        error: `HTTP ${response.status}`,
      };
    }

    const result = await response.json();

    if (result.errors?.length) {
      return {
        success: false,
        platform: "lesswrong",
        error: result.errors.map((e: { message: string }) => e.message).join(", "),
      };
    }

    const commentData = result.data?.createComment?.data;
    const userSlug = commentData?.user?.slug;
    const url = userSlug
      ? `https://www.lesswrong.com/users/${userSlug}?tab=shortform`
      : undefined;

    return { success: true, platform: "lesswrong", url };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, platform: "lesswrong", error: msg };
  }
}
