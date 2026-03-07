import type { OnloadArgs, ExtensionAPI, PlatformId } from "./types";
import { renderPublishOverlay } from "./components/PublishOverlay";

declare const window: Window & {
  roamAlphaAPI: any;
};

const BUTTON_COMMANDS: { command: string; target: "all" | PlatformId }[] = [
  { command: "publish", target: "all" },
  { command: "tweet", target: "twitter" },
  { command: "bsky", target: "bluesky" },
  { command: "lesswrong", target: "lesswrong" },
];

const observers: MutationObserver[] = [];
const styleEl: HTMLStyleElement[] = [];

function createButtonObserver(
  command: string,
  target: "all" | PlatformId,
  extensionAPI: ExtensionAPI
) {
  const className = `roamjs-${command}-button`;

  const processButton = (el: HTMLElement) => {
    const blockEl = el.closest(".roam-block") as HTMLElement;
    if (!blockEl) return;
    const blockUid = blockEl.id?.match(/(.{9,12})$/)?.[1];
    if (!blockUid) return;

    // Replace the button with our publish overlay
    const container = el.closest(".rm-block-main") || el.parentElement;
    if (!container) return;

    // Check if we already rendered
    if (container.querySelector(`.smp-overlay-${command}`)) return;

    const span = document.createElement("span");
    span.className = `smp-overlay-${command}`;
    // Insert after the button content area
    const refArea = el.closest(".rm-block__controls")?.nextElementSibling || el.parentElement;
    if (refArea) {
      refArea.appendChild(span);
    }

    renderPublishOverlay({ parent: span, blockUid, extensionAPI, target });
  };

  // Observe DOM for button appearances
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLElement) {
          // Look for Roam button blocks with our command
          const buttons = node.querySelectorAll
            ? node.querySelectorAll(`[data-tag="${command}"], .rm-block__input`)
            : [];
          buttons.forEach((btn) => {
            if (btn instanceof HTMLElement) {
              const text = btn.textContent || "";
              if (text.includes(`{{${command}}}`)) {
                processButton(btn);
              }
            }
          });
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  observers.push(observer);

  // Process existing buttons on page
  document.querySelectorAll(".roam-block").forEach((block) => {
    const text = block.textContent || "";
    for (const { command: cmd, target: tgt } of BUTTON_COMMANDS) {
      if (text.includes(`{{${cmd}}}`)) {
        processButton(block as HTMLElement);
      }
    }
  });
}

function addStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .smp-char-count {
      font-family: monospace;
      pointer-events: none;
    }
    .smp-overlay-publish,
    .smp-overlay-tweet,
    .smp-overlay-bsky,
    .smp-overlay-lesswrong {
      display: inline-block;
      vertical-align: middle;
    }
  `;
  document.head.appendChild(style);
  styleEl.push(style);
}

export default {
  onload: ({ extensionAPI }: OnloadArgs) => {
    addStyles();

    // Register settings panel
    extensionAPI.settings.panel.create({
      tabTitle: "Social Media Publisher",
      settings: [
        // Twitter
        {
          id: "twitter-api-key",
          name: "Twitter API Key",
          description: "Consumer API Key from X Developer Portal",
          action: { type: "input", placeholder: "API Key" },
        },
        {
          id: "twitter-api-secret",
          name: "Twitter API Secret",
          description: "Consumer API Secret",
          action: { type: "input", placeholder: "API Secret" },
        },
        {
          id: "twitter-access-token",
          name: "Twitter Access Token",
          description: "User Access Token from X Developer Portal",
          action: { type: "input", placeholder: "Access Token" },
        },
        {
          id: "twitter-access-token-secret",
          name: "Twitter Access Token Secret",
          description: "User Access Token Secret",
          action: { type: "input", placeholder: "Access Token Secret" },
        },
        // Bluesky
        {
          id: "bluesky-handle",
          name: "Bluesky Handle",
          description: "Your Bluesky handle (e.g., user.bsky.social)",
          action: { type: "input", placeholder: "user.bsky.social" },
        },
        {
          id: "bluesky-app-password",
          name: "Bluesky App Password",
          description: "App Password from Bluesky Settings > App Passwords",
          action: { type: "input", placeholder: "xxxx-xxxx-xxxx-xxxx" },
        },
        // LessWrong
        {
          id: "lesswrong-login-token",
          name: "LessWrong Login Token",
          description: "Login token from browser cookies (cookie name: loginToken)",
          action: { type: "input", placeholder: "Login Token" },
        },
      ],
    });

    // Register command palette commands
    extensionAPI.ui.commandPalette.addCommand({
      label: "Social Media Publisher: Publish current block",
      callback: () => {
        const focused = window.roamAlphaAPI.ui.getFocusedBlock();
        if (!focused) return;
        const blockUid = focused["block-uid"];
        // Open the publish overlay programmatically
        const blockEl = document.querySelector(`[id$="${blockUid}"]`);
        if (!blockEl) return;
        const mainEl = blockEl.closest(".rm-block-main") || blockEl;
        let overlay = mainEl.querySelector(".smp-overlay-publish");
        if (!overlay) {
          overlay = document.createElement("span");
          overlay.className = "smp-overlay-publish";
          mainEl.appendChild(overlay);
        }
        renderPublishOverlay({
          parent: overlay as HTMLSpanElement,
          blockUid,
          extensionAPI,
          target: "all",
        });
      },
    });

    // Register block context menu commands
    window.roamAlphaAPI.ui.blockContextMenu.addCommand({
      label: "Publish to Social Media",
      callback: (context: { "block-uid": string }) => {
        const blockUid = context["block-uid"];
        const blockEl = document.querySelector(`[id$="${blockUid}"]`);
        if (!blockEl) return;
        const mainEl = blockEl.closest(".rm-block-main") || blockEl;
        let overlay = mainEl.querySelector(".smp-overlay-publish");
        if (!overlay) {
          overlay = document.createElement("span");
          overlay.className = "smp-overlay-publish";
          mainEl.appendChild(overlay);
        }
        renderPublishOverlay({
          parent: overlay as HTMLSpanElement,
          blockUid,
          extensionAPI,
          target: "all",
        });
      },
    });

    // Watch for {{publish}}, {{tweet}}, {{bsky}}, {{lesswrong}} buttons
    for (const { command, target } of BUTTON_COMMANDS) {
      createButtonObserver(command, target, extensionAPI);
    }
  },

  onunload: () => {
    // Clean up observers
    observers.forEach((o) => o.disconnect());
    observers.length = 0;

    // Clean up styles
    styleEl.forEach((s) => s.remove());
    styleEl.length = 0;

    // Remove command palette commands
    window.roamAlphaAPI.ui.commandPalette?.removeCommand?.({
      label: "Social Media Publisher: Publish current block",
    });

    // Remove block context menu commands
    window.roamAlphaAPI.ui.blockContextMenu?.removeCommand?.({
      label: "Publish to Social Media",
    });

    // Clean up rendered overlays
    document.querySelectorAll('[class^="smp-overlay"]').forEach((el) => {
      try {
        (window as any).ReactDOM?.unmountComponentAtNode(el);
      } catch {}
      el.remove();
    });
  },
};
