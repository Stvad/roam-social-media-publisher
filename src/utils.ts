declare const window: Window & {
  roamAlphaAPI: any;
};

// Get CORS proxy URL from Roam
export function getCorsProxyUrl(): string {
  return window.roamAlphaAPI?.constants?.corsAnywhereProxyUrl || "";
}

const BLOCK_REF_REGEX = /\(\(([\w\d-]{9,10})\)\)/g;
const PAGE_REF_REGEX = /\[\[([^\]]+)\]\]/g;
const HASHTAG_PAGE_REF_REGEX = /#\[\[([^\]]+)\]\]/g;
const IMAGE_REGEX = /!\[[^\]]*\]\(([^\s)]*)\)/g;
const ALIAS_REGEX = /\[([^\]]*)\]\(([^)]+)\)/g;
const BUTTON_REGEX = /\{\{[^}]*\}\}/g;
const BOLD_REGEX = /\*\*(.+?)\*\*/g;
const ITALIC_REGEX = /__(.+?)__/g;
const HIGHLIGHT_REGEX = /\^\^(.+?)\^\^/g;
const STRIKETHROUGH_REGEX = /~~(.+?)~~/g;
const INLINE_CODE_REGEX = /`([^`]+)`/g;

export interface ProcessedBlock {
  text: string;
  mediaUrls: string[];
}

// Full preprocessing pipeline for a block string before posting.
// Extracts media URLs, resolves references, cleans Roam markup.
export function processBlockText(raw: string): ProcessedBlock {
  if (!raw) return { text: "", mediaUrls: [] };

  let text = raw;

  // 1. Extract image attachments (remove from text, collect URLs)
  const mediaUrls: string[] = [];
  text = text.replace(IMAGE_REGEX, (_, url) => {
    mediaUrls.push(url);
    return "";
  });

  // 2. Resolve block references ((uid)) -> referenced block's text
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

  // 3. Process markdown alias links [text](url) -> text (url preserved in facets later)
  //    but for plain-text platforms we keep just the URL
  text = text.replace(ALIAS_REGEX, "$2");

  // 4. Convert #[[Page Ref]] -> #PageRef (hashtag, spaces removed)
  text = text.replace(HASHTAG_PAGE_REF_REGEX, (_, pageName) => {
    return `#${pageName.replace(/\s+/g, "")}`;
  });

  // 5. Convert [[Page Ref]] -> #PageRef (hashtag, spaces removed)
  text = text.replace(PAGE_REF_REGEX, (_, pageName) => {
    return `#${pageName.replace(/\s+/g, "")}`;
  });

  // 6. Strip Roam formatting markup
  text = text.replace(BOLD_REGEX, "$1");
  text = text.replace(ITALIC_REGEX, "$1");
  text = text.replace(HIGHLIGHT_REGEX, "$1");
  text = text.replace(STRIKETHROUGH_REGEX, "$1");
  text = text.replace(INLINE_CODE_REGEX, "$1");

  // 7. Remove button/component syntax {{command}}
  text = text.replace(BUTTON_REGEX, "");

  // 8. Clean up whitespace
  text = text.replace(/  +/g, " ").trim();

  return { text, mediaUrls };
}

// Simple version that just returns the cleaned text (for char counting etc.)
export function resolveBlockText(raw: string): string {
  return processBlockText(raw).text;
}

// Get child blocks of a given block UID
export function getChildBlocks(blockUid: string): { uid: string; text: string }[] {
  try {
    const result = window.roamAlphaAPI.data.pull(
      "[:block/string :block/uid :block/order {:block/children [:block/string :block/uid :block/order]}]",
      [":block/uid", blockUid]
    );
    const children = result?.[":block/children"] || [];
    return children
      .sort((a: any, b: any) => a[":block/order"] - b[":block/order"])
      .map((c: any) => ({
        uid: c[":block/uid"],
        text: c[":block/string"] || "",
      }));
  } catch {
    return [];
  }
}

// Get a block's text
export function getBlockText(blockUid: string): string {
  try {
    const result = window.roamAlphaAPI.data.pull("[:block/string]", [":block/uid", blockUid]);
    return result?.[":block/string"] || "";
  } catch {
    return "";
  }
}
