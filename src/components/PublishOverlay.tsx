import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import type { ExtensionAPI, PlatformId, PostResult } from "../types";
import { getChildBlocks, getBlockText, resolveBlockText } from "../utils";
import { isTwitterConfigured, validateTwitterThread, postToTwitter, TWITTER_CHAR_MAX } from "../platforms/twitter";
import { isBlueskyConfigured, validateBlueskyThread, postToBluesky, BLUESKY_CHAR_MAX } from "../platforms/bluesky";
import { isLessWrongConfigured, postToLessWrong } from "../platforms/lesswrong";

declare const window: Window & { roamAlphaAPI: any };

const Blueprint = (window as any).Blueprint?.Core;
const { Button, Popover, Spinner, Icon, Tooltip, Checkbox } = Blueprint;

type TargetPlatform = "all" | PlatformId;

interface Props {
  blockUid: string;
  extensionAPI: ExtensionAPI;
  target: TargetPlatform;
}

const PLATFORM_LABELS: Record<PlatformId, string> = {
  twitter: "X / Twitter",
  bluesky: "Bluesky",
  lesswrong: "LessWrong",
};

const PlatformIcon: React.FC<{ platform: PlatformId; size?: number }> = ({ platform, size = 14 }) => {
  const icons: Record<PlatformId, string> = {
    twitter: "\u{1D54F}",
    bluesky: "\uD83E\uDD8B",
    lesswrong: "LW",
  };
  return (
    <span style={{ fontSize: size, fontWeight: "bold", marginRight: 4 }}>
      {icons[platform]}
    </span>
  );
};

const ResultLine: React.FC<{ result: PostResult }> = ({ result }) => (
  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
    <PlatformIcon platform={result.platform} />
    {result.success ? (
      <>
        <Icon icon="tick-circle" intent="success" size={14} />
        {result.url && (
          <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
            View post
          </a>
        )}
      </>
    ) : (
      <>
        <Icon icon="error" intent="danger" size={14} />
        <span style={{ color: "red", fontSize: 12 }}>{result.error}</span>
      </>
    )}
  </div>
);

const PublishContent: React.FC<
  Props & { close: () => void }
> = ({ blockUid, extensionAPI, target, close }) => {
  const blocks = useMemo(() => getChildBlocks(blockUid), [blockUid]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<PostResult[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<PlatformId>>(() => {
    const set = new Set<PlatformId>();
    if (target === "all") {
      if (isTwitterConfigured(extensionAPI)) set.add("twitter");
      if (isBlueskyConfigured(extensionAPI)) set.add("bluesky");
      if (isLessWrongConfigured(extensionAPI)) set.add("lesswrong");
    } else {
      set.add(target);
    }
    return set;
  });

  const togglePlatform = useCallback((p: PlatformId) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (blocks.length === 0) {
      errors.push("No child blocks found. Add content as child blocks.");
    }
    if (selectedPlatforms.has("twitter")) {
      const v = validateTwitterThread(blocks);
      if (!v.valid) v.errors.forEach((e) => errors.push(`Twitter: ${e.reason}`));
    }
    if (selectedPlatforms.has("bluesky")) {
      const v = validateBlueskyThread(blocks);
      if (!v.valid) v.errors.forEach((e) => errors.push(`Bluesky: ${e.reason}`));
    }
    return { valid: errors.length === 0, errors };
  }, [blocks, selectedPlatforms]);

  const onPublish = useCallback(async () => {
    setSending(true);
    setResults([]);
    const content = { blocks };

    const promises: Promise<PostResult>[] = [];
    if (selectedPlatforms.has("twitter")) promises.push(postToTwitter(content, extensionAPI));
    if (selectedPlatforms.has("bluesky")) promises.push(postToBluesky(content, extensionAPI));
    if (selectedPlatforms.has("lesswrong")) promises.push(postToLessWrong(content, extensionAPI));

    const settled = await Promise.allSettled(promises);
    const newResults: PostResult[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled") newResults.push(r.value);
      else newResults.push({ success: false, platform: "twitter", error: r.reason?.message || "Unknown error" });
    }
    setResults(newResults);
    setSending(false);

    // Append post links and timestamp to parent block on success
    const successResults = newResults.filter((r) => r.success && r.url);
    if (successResults.length > 0) {
      const parentText = getBlockText(blockUid);
      const links = successResults.map((r) => `[${PLATFORM_LABELS[r.platform]}](${r.url})`).join(" ");
      const timestamp = new Date().toLocaleString();
      window.roamAlphaAPI.updateBlock({
        block: {
          uid: blockUid,
          string: `${parentText} (Posted ${timestamp}: ${links})`,
        },
      });
    }
  }, [blocks, selectedPlatforms, extensionAPI, blockUid]);

  const allConfigured: PlatformId[] = useMemo(() => {
    const platforms: PlatformId[] = [];
    if (isTwitterConfigured(extensionAPI)) platforms.push("twitter");
    if (isBlueskyConfigured(extensionAPI)) platforms.push("bluesky");
    if (isLessWrongConfigured(extensionAPI)) platforms.push("lesswrong");
    return platforms;
  }, [extensionAPI]);

  const allDone = results.length > 0 && !sending;
  const allSuccess = allDone && results.every((r) => r.success);

  return (
    <div style={{ padding: 16, maxWidth: 360, minWidth: 280 }}>
      {allConfigured.length === 0 ? (
        <div style={{ color: "#888" }}>
          No platforms configured. Open extension settings to add credentials.
        </div>
      ) : (
        <>
          {target === "all" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Publish to:</div>
              {allConfigured.map((p) => (
                <Checkbox
                  key={p}
                  checked={selectedPlatforms.has(p)}
                  onChange={() => togglePlatform(p)}
                  label={
                    <span style={{ display: "inline-flex", alignItems: "center" }}>
                      <PlatformIcon platform={p} />
                      {PLATFORM_LABELS[p]}
                    </span>
                  }
                  style={{ marginBottom: 2 }}
                />
              ))}
            </div>
          )}

          <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
            {blocks.length} block{blocks.length !== 1 ? "s" : ""} to publish
            {selectedPlatforms.has("twitter") && blocks.length > 0 &&
              ` (thread of ${blocks.length} tweet${blocks.length !== 1 ? "s" : ""})`}
          </div>

          {!validation.valid && (
            <div style={{ marginBottom: 8, padding: 8, background: "#fff3f3", borderRadius: 4, fontSize: 12 }}>
              {validation.errors.map((e, i) => (
                <div key={i} style={{ color: "red" }}>{e}</div>
              ))}
            </div>
          )}

          {!allDone && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button
                intent="primary"
                text="Publish"
                onClick={onPublish}
                disabled={!validation.valid || sending || selectedPlatforms.size === 0}
              />
              {sending && <Spinner size={20} />}
            </div>
          )}

          {results.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {results.map((r, i) => (
                <ResultLine key={i} result={r} />
              ))}
              {allSuccess && (
                <div style={{ marginTop: 8, color: "green", fontSize: 12 }}>
                  All posts published successfully!
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Helper: extract block uid from a Roam textarea or block element
function getUidFromElement(el: HTMLElement): string {
  const id = el.id || el.closest(".roam-block")?.id || "";
  return id.length >= 9 ? id.substring(id.length - 9) : "";
}

interface CountEntry {
  uid: string;
  count: number;
}

const PublishOverlay: React.FC<
  Props & { childrenRef?: HTMLDivElement; unmount: () => void }
> = ({ childrenRef, unmount, ...props }) => {
  const { blockUid, target } = props;
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<any>(null);

  // Determine char limit based on target
  const showTwitter = target === "all" || target === "twitter";
  const showBluesky = target === "all" || target === "bluesky";
  const charMax = showBluesky ? BLUESKY_CHAR_MAX : showTwitter ? TWITTER_CHAR_MAX : null;

  // Calculate counts from Roam DB
  const calcCounts = useCallback((): CountEntry[] => {
    return getChildBlocks(blockUid).map((b) => {
      const text = resolveBlockText(b.text);
      const count = showBluesky ? [...text].length : text.length;
      return { uid: b.uid, count };
    });
  }, [blockUid, showBluesky]);

  // Get DOM elements for child blocks (for portal rendering)
  const calcBlockEls = useCallback(
    () =>
      Array.from(childrenRef?.children || [])
        .filter((c) => c.className.includes("roam-block-container"))
        .map(
          (c) =>
            Array.from(c.children).find((c) =>
              c.className.includes("rm-block-main")
            ) as HTMLDivElement
        ),
    [childrenRef]
  );

  const [counts, setCounts] = useState<CountEntry[]>(calcCounts);
  const blockEls = useRef(calcBlockEls());

  // Listen for input events on children to update counts live
  const inputCallback = useCallback(
    (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA") {
        const textarea = target as HTMLTextAreaElement;
        const currentUid = getUidFromElement(textarea);
        blockEls.current = calcBlockEls();
        setCounts(
          calcCounts().map((c) => {
            if (c.uid === currentUid) {
              // Use live textarea value instead of DB value
              const text = resolveBlockText(textarea.value);
              const count = showBluesky ? [...text].length : text.length;
              return { uid: currentUid, count };
            }
            return c;
          })
        );
      }
    },
    [calcCounts, calcBlockEls, showBluesky]
  );

  useEffect(() => {
    if (!childrenRef) return;
    childrenRef.addEventListener("input", inputCallback);
    return () => childrenRef.removeEventListener("input", inputCallback);
  }, [childrenRef, inputCallback]);

  // Also refresh counts when popover opens or children change
  useEffect(() => {
    blockEls.current = calcBlockEls();
    setCounts(calcCounts());
  }, [isOpen]);

  useEffect(() => {
    if (rootRef.current && !document.contains(rootRef.current.targetElement)) {
      unmount();
    }
  });

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const buttonLabel = target === "all" ? "\uD83D\uDCE1" : target === "twitter" ? "\u{1D54F}" : target === "bluesky" ? "\uD83E\uDD8B" : "LW";

  return (
    <>
      <Popover
        target={
          <span
            onClick={open}
            style={{
              cursor: "pointer",
              fontSize: 15,
              userSelect: "none",
            }}
            title={`Publish to ${target === "all" ? "all platforms" : PLATFORM_LABELS[target]}`}
          >
            {buttonLabel}
          </span>
        }
        content={<PublishContent {...props} close={close} />}
        isOpen={isOpen}
        onInteraction={(next: boolean) => setIsOpen(next)}
        ref={rootRef}
      />
      {/* Inline character counts via portals */}
      {charMax &&
        counts
          .map((c, i) => ({ ...c, el: blockEls.current[i] }))
          .filter((c) => c.el)
          .map((c) =>
            ReactDOM.createPortal(
              <span
                className="smp-char-count"
                style={{
                  color: c.count > charMax ? "red" : "#999",
                  fontSize: 11,
                  marginLeft: 4,
                }}
              >
                {c.count}/{charMax}
              </span>,
              c.el
            )
          )}
    </>
  );
};

export function renderPublishOverlay({
  parent,
  blockUid,
  extensionAPI,
  target,
}: {
  parent: HTMLElement;
  blockUid: string;
  extensionAPI: ExtensionAPI;
  target: TargetPlatform;
}): void {
  // childrenRef is the div containing child block containers,
  // which is the next sibling of .rm-block-main
  const blockContainer = parent.closest(".roam-block-container");
  const childrenRef = blockContainer?.querySelector(
    ":scope > .rm-block-children"
  ) as HTMLDivElement | null;

  if (childrenRef) {
    Array.from(childrenRef.getElementsByClassName("smp-char-count")).forEach((s) => s.remove());
  }
  ReactDOM.render(
    <PublishOverlay
      blockUid={blockUid}
      extensionAPI={extensionAPI}
      target={target}
      childrenRef={childrenRef || undefined}
      unmount={() => ReactDOM.unmountComponentAtNode(parent)}
    />,
    parent
  );
}

export default PublishOverlay;
