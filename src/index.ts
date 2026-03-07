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
  // Find the block UID from the enclosing block
  // Roam DOM: .roam-block-container > .rm-block-main > .rm-block__input (has id)
  // The id format is "block-input-{windowId}-{blockUid}" where blockUid is last 9 chars
  const blockContainer = button.closest(".roam-block-container") as HTMLElement;
  if (!blockContainer) return;
  const blockInput = blockContainer.querySelector(".rm-block__input") as HTMLElement;
  const roamBlock = button.closest(".roam-block") as HTMLElement;
  const idSource = blockInput?.id || roamBlock?.id || "";
  if (idSource.length < 9) return;
  const blockUid = idSource.substring(idSource.length - 9);

  // Hide the original Roam button and render our overlay into its parent
  // (same pattern as roamjs-twitter: render into b.parentElement)
  const parentEl = button.parentElement;
  if (!parentEl) return;
  if (parentEl.querySelector(`.smp-overlay-${command}`)) return;

  button.style.display = "none";

  const span = document.createElement("span");
  span.className = `smp-overlay-${command}`;
  parentEl.appendChild(span);

  renderPublishOverlay({ parent: span, blockUid, extensionAPI, target });
}

function createButtonObserver(
  command: string,
  target: "all" | PlatformId,
  extensionAPI: ExtensionAPI
) {
  const dataAttr = `data-smp-${command}`;
  const commandUpper = command.toUpperCase();

  const isMatch = (el: HTMLElement) =>
    el.nodeName === "BUTTON" &&
    el.classList.contains("bp3-button") &&
    el.innerText.toUpperCase() === commandUpper;

  const tryProcess = (el: HTMLElement) => {
    if (!isMatch(el)) return;
    if (el.getAttribute(dataAttr)) return;
    el.setAttribute(dataAttr, "true");
    processButton(el, command, target, extensionAPI);
  };

  const scanChildren = (root: Node) => {
    const buttons = (root as HTMLElement).getElementsByClassName?.("bp3-button");
    if (!buttons) return;
    Array.from(buttons)
      .filter((b) => b.nodeName === "BUTTON")
      .forEach((b) => tryProcess(b as HTMLElement));
  };

  // Process existing buttons already on page
  scanChildren(document);

  // Observe DOM for new buttons appearing
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        if (isMatch(node)) {
          tryProcess(node);
        }
        scanChildren(node);
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
        // Twitter (via Buffer)
        {
          id: "buffer-api-token",
          name: "Buffer API Token (for Twitter/X)",
          description: "Connect X in Buffer, then go to My Preferences > API and copy the Access Token",
          action: { type: "input", placeholder: "Buffer API Token" },
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
          description: "Settings > Privacy and Security > App Passwords > Add App Password",
          action: { type: "input", placeholder: "xxxx-xxxx-xxxx-xxxx" },
        },
        // LessWrong
        {
          id: "lesswrong-login-token",
          name: "LessWrong Login Token",
          description: "DevTools > Application > Cookies > lesswrong.com > copy 'loginToken' value",
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
