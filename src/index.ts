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

function processButton(
  button: HTMLElement,
  command: string,
  target: "all" | PlatformId,
  extensionAPI: ExtensionAPI
) {
  // Find the block UID from the enclosing roam-block container
  const blockEl = button.closest(".roam-block") as HTMLElement;
  if (!blockEl) return;
  const blockUid = blockEl.id?.match(/(.{9,12})$/)?.[1];
  if (!blockUid) return;

  // Check if we already rendered our overlay next to this button
  if (button.parentElement?.querySelector(`.smp-overlay-${command}`)) return;

  // Create overlay span and insert right after the button
  const span = document.createElement("span");
  span.className = `smp-overlay-${command}`;
  button.insertAdjacentElement("afterend", span);

  renderPublishOverlay({ parent: span, blockUid, extensionAPI, target });
}

function createButtonObserver(
  command: string,
  target: "all" | PlatformId,
  extensionAPI: ExtensionAPI
) {
  const selector = `button.bp3-button.dont-focus-block[data-tag="${command}"]`;

  const scanAndProcess = (root: HTMLElement | Document) => {
    root.querySelectorAll(selector).forEach((btn) => {
      processButton(btn as HTMLElement, command, target, extensionAPI);
    });
  };

  // Process existing buttons already on page
  scanAndProcess(document);

  // Observe DOM for new buttons appearing (page navigation, block expansion, etc.)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        // Check if the added node itself is a matching button
        if (node.matches?.(selector)) {
          processButton(node, command, target, extensionAPI);
        }
        // Check descendants of the added node
        scanAndProcess(node);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  observers.push(observer);
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
