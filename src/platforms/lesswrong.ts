import type { PostContent, PostResult } from "../types";
import type { ExtensionAPI } from "../types";
import { getCorsProxyUrl, resolveBlockText } from "../utils";

const LW_GRAPHQL_URL = "https://www.lesswrong.com/graphql";

function getCredentials(extensionAPI: ExtensionAPI): { loginToken: string } | null {
  const loginToken = extensionAPI.settings.get("lesswrong-login-token") as string;
  if (!loginToken) return null;
  return { loginToken };
}

// Convert plain text blocks into HTML for LessWrong
function blocksToHtml(blocks: { text: string }[]): string {
  const paragraphs = blocks.map((b) => {
    const text = resolveBlockText(b.text);
    // Basic markdown-like conversion
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Convert **bold** and *italic*
    let html = escaped
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    return `<p>${html}</p>`;
  });

  return paragraphs.join("\n");
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
    const commentId = commentData?._id;
    const url = userSlug
      ? `https://www.lesswrong.com/users/${userSlug}?tab=shortform`
      : undefined;

    return { success: true, platform: "lesswrong", url };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, platform: "lesswrong", error: msg };
  }
}
