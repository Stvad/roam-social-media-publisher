declare const window: Window & {
  roamAlphaAPI: any;
};

// Get CORS proxy URL from Roam
export function getCorsProxyUrl(): string {
  return window.roamAlphaAPI?.constants?.corsAnywhereProxyUrl || "";
}

// Resolve Roam block references and clean up markup for plain text posting
export function resolveBlockText(text: string): string {
  let resolved = text;

  // Resolve block references ((uid)) -> their text
  const blockRefRegex = /\(\(([a-zA-Z0-9_-]{9,12})\)\)/g;
  resolved = resolved.replace(blockRefRegex, (_, uid) => {
    try {
      const result = window.roamAlphaAPI.data.pull("[:block/string]", [":block/uid", uid]);
      return result?.[":block/string"] || `((${uid}))`;
    } catch {
      return `((${uid}))`;
    }
  });

  // Strip Roam page references [[Page]] -> Page
  resolved = resolved.replace(/\[\[([^\]]+)\]\]/g, "$1");

  // Strip #[[tag]] -> tag
  resolved = resolved.replace(/#\[\[([^\]]+)\]\]/g, "$1");

  // Strip #tags -> tags (only standalone hashtags that are Roam tags)
  // Keep hashtags that look intentional for social media

  // Strip bold/italic markers for non-markdown platforms
  // (kept as-is since Twitter/Bluesky display plain text)

  // Remove image embeds ![alt](url) -> url
  resolved = resolved.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$2");

  // Strip button syntax {{text}} -> empty (these are Roam commands)
  resolved = resolved.replace(/\{\{[^}]*\}\}/g, "").trim();

  return resolved;
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
