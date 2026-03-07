import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import type { ExtensionAPI, PlatformId, PostResult } from "../types";
import { getChildBlocks, resolveBlockText } from "../utils";
import { isTwitterConfigured, validateTwitterThread, postToTwitter, TWITTER_CHAR_MAX } from "../platforms/twitter";
import { isBlueskyConfigured, validateBlueskyThread, postToBluesky, BLUESKY_CHAR_MAX } from "../platforms/bluesky";
import { isLessWrongConfigured, postToLessWrong } from "../platforms/lesswrong";

const Blueprint = (window as any).Blueprint?.Core;
const { Button, Popover, Spinner, Icon, Alert, Tooltip, Checkbox } = Blueprint;

type TargetPlatform = "all" | PlatformId;

interface Props {
  blockUid: string;
  extensionAPI: ExtensionAPI;
  target: TargetPlatform;
}

interface CharCount {
  uid: string;
  twitter?: number;
  bluesky?: number;
}

const PLATFORM_LABELS: Record<PlatformId, string> = {
  twitter: "X / Twitter",
  bluesky: "Bluesky",
  lesswrong: "LessWrong",
};

const PlatformIcon: React.FC<{ platform: PlatformId; size?: number }> = ({ platform, size = 14 }) => {
  const icons: Record<PlatformId, string> = {
    twitter: "𝕏",
    bluesky: "🦋",
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

  // Validation
  const validation = useMemo(() => {
    const errors: string[] = [];
    if (blocks.length === 0) {
      errors.push("No child blocks found. Add content as child blocks.");
    }

    if (selectedPlatforms.has("twitter")) {
      const v = validateTwitterThread(blocks);
      if (!v.valid) {
        v.errors.forEach((e) => errors.push(`Twitter: ${e.reason} (block ${e.uid})`));
      }
    }

    if (selectedPlatforms.has("bluesky")) {
      const v = validateBlueskyThread(blocks);
      if (!v.valid) {
        v.errors.forEach((e) => errors.push(`Bluesky: ${e.reason} (block ${e.uid})`));
      }
    }

    return { valid: errors.length === 0, errors };
  }, [blocks, selectedPlatforms]);

  const onPublish = useCallback(async () => {
    setSending(true);
    setResults([]);
    const content = { blocks };
    const newResults: PostResult[] = [];

    const promises: Promise<PostResult>[] = [];
    if (selectedPlatforms.has("twitter")) {
      promises.push(postToTwitter(content, extensionAPI));
    }
    if (selectedPlatforms.has("bluesky")) {
      promises.push(postToBluesky(content, extensionAPI));
    }
    if (selectedPlatforms.has("lesswrong")) {
      promises.push(postToLessWrong(content, extensionAPI));
    }

    const settled = await Promise.allSettled(promises);
    for (const r of settled) {
      if (r.status === "fulfilled") {
        newResults.push(r.value);
      } else {
        newResults.push({ success: false, platform: "twitter", error: r.reason?.message || "Unknown error" });
      }
    }

    setResults(newResults);
    setSending(false);
  }, [blocks, selectedPlatforms, extensionAPI]);

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
          {/* Platform selection */}
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

          {/* Content preview */}
          <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
            {blocks.length} block{blocks.length !== 1 ? "s" : ""} to publish
            {selectedPlatforms.has("twitter") && ` (thread of ${blocks.length} tweet${blocks.length !== 1 ? "s" : ""})`}
          </div>

          {/* Validation errors */}
          {!validation.valid && (
            <div style={{ marginBottom: 8, padding: 8, background: "#fff3f3", borderRadius: 4, fontSize: 12 }}>
              {validation.errors.map((e, i) => (
                <div key={i} style={{ color: "red" }}>{e}</div>
              ))}
            </div>
          )}

          {/* Publish button */}
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

          {/* Results */}
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

const PublishOverlay: React.FC<
  Props & { childrenRef?: HTMLDivElement; unmount: () => void }
> = ({ childrenRef, unmount, ...props }) => {
  const { blockUid, extensionAPI, target } = props;
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<any>(null);
  const blocks = useMemo(() => getChildBlocks(blockUid), [blockUid]);

  // Compute character counts for inline display
  const charCounts = useMemo(() => {
    return blocks.map((b) => {
      const text = resolveBlockText(b.text);
      return {
        uid: b.uid,
        twitter: text.length,
        bluesky: [...text].length,
      };
    });
  }, [blocks]);

  const calcBlocks = useCallback(
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

  const [blockElements, setBlockElements] = useState(calcBlocks);
  const [liveCounts, setLiveCounts] = useState(charCounts);

  // Listen to input changes for live character counts
  useEffect(() => {
    if (!childrenRef) return;
    const listener = () => {
      setBlockElements(calcBlocks());
      const updatedBlocks = getChildBlocks(blockUid);
      setLiveCounts(
        updatedBlocks.map((b) => {
          const text = resolveBlockText(b.text);
          return { uid: b.uid, twitter: text.length, bluesky: [...text].length };
        })
      );
    };
    childrenRef.addEventListener("input", listener);
    return () => childrenRef.removeEventListener("input", listener);
  }, [childrenRef, blockUid, calcBlocks]);

  useEffect(() => {
    if (rootRef.current && !document.contains(rootRef.current.targetElement)) {
      unmount();
    }
  });

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Determine the most restrictive char limit to show
  const showTwitter = target === "all" || target === "twitter";
  const showBluesky = target === "all" || target === "bluesky";
  const charMax = showBluesky ? BLUESKY_CHAR_MAX : showTwitter ? TWITTER_CHAR_MAX : null;

  const buttonLabel = target === "all" ? "📡" : target === "twitter" ? "𝕏" : target === "bluesky" ? "🦋" : "LW";

  return (
    <>
      <Popover
        target={
          <span
            onClick={open}
            style={{
              cursor: "pointer",
              marginLeft: 4,
              fontSize: 14,
              opacity: 0.8,
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
        liveCounts
          .map((c, i) => ({ ...c, el: blockElements[i] }))
          .filter((c) => c.el)
          .map((c) => {
            const count = target === "bluesky" ? c.bluesky : c.twitter;
            return ReactDOM.createPortal(
              <span
                className="smp-char-count"
                style={{
                  color: count > charMax ? "red" : "#999",
                  fontSize: 11,
                  marginLeft: 4,
                  position: "relative",
                }}
              >
                {count}/{charMax}
              </span>,
              c.el
            );
          })}
    </>
  );
};

export function renderPublishOverlay({
  parent,
  blockUid,
  extensionAPI,
  target,
}: {
  parent: HTMLSpanElement;
  blockUid: string;
  extensionAPI: ExtensionAPI;
  target: TargetPlatform;
}): void {
  const childrenRef = parent.closest(".rm-block-main")?.nextElementSibling as HTMLDivElement;
  if (childrenRef) {
    Array.from(childrenRef.getElementsByClassName("smp-char-count")).forEach((s) => s.remove());
  }
  ReactDOM.render(
    <PublishOverlay
      blockUid={blockUid}
      extensionAPI={extensionAPI}
      target={target}
      childrenRef={childrenRef}
      unmount={() => ReactDOM.unmountComponentAtNode(parent)}
    />,
    parent
  );
}

export default PublishOverlay;
