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

const SLASH_COMMANDS = [
  { label: "Tweet", buttonText: "tweet" },
  { label: "Bluesky Post", buttonText: "bsky" },
  { label: "LessWrong Post", buttonText: "lesswrong" },
  { label: "Publish to All", buttonText: "publish" },
] as const;

const observers: MutationObserver[] = [];
const styleEl: HTMLStyleElement[] = [];
const cleanupFns: Array<() => void> = [];

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function getActiveBlockEditor() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  return (
    (active.closest(".rm-block__input, .rm-block-input, .dont-unfocus-block") as HTMLElement | null) ||
    null
  );
}

function getEditorText(editor: HTMLElement | null) {
  if (!editor) return "";
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    return editor.value;
  }
  return editor.innerText || editor.textContent || "";
}

function isVisible(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isSelectedSlashCommandItem(el: HTMLElement) {
  if (el.getAttribute("aria-selected") === "true" || el.getAttribute("aria-current") === "true") {
    return true;
  }
  if (el.classList.contains("bp3-active") || el.classList.contains("bp3-intent-primary")) {
    return true;
  }
  return Boolean(el.style.backgroundColor);
}

function getSlashCommandMenuItem() {
  const labels = new Set(SLASH_COMMANDS.map((command) => normalizeText(command.label)));
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        ".bp3-popover .bp3-menu-item",
        ".bp3-popover .rm-menu-item",
        ".bp3-elevation-3 .bp3-menu-item",
        ".bp3-elevation-3 .rm-menu-item",
        ".bp3-elevation-3 button.bp3-button",
      ].join(", ")
    )
  ).filter((el) => {
    if (!isVisible(el)) return false;
    const text = normalizeText(el.innerText || el.textContent || "");
    return Array.from(labels).some((label) => text === label || text.startsWith(`${label} `));
  });

  return candidates.find((el) => isSelectedSlashCommandItem(el)) || (candidates.length === 1 ? candidates[0] : null);
}

function activateSlashCommandMenuItem(menuItem: HTMLElement) {
  for (const type of ["mousedown", "mouseup", "click"] as const) {
    menuItem.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
  }
}

function installSlashCommandEnterGuard() {
  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.key !== "Enter" ||
      event.defaultPrevented ||
      event.isComposing ||
      event.shiftKey ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    ) {
      return;
    }

    const editor = getActiveBlockEditor();
    if (!editor) return;
    if (!getEditorText(editor).trimStart().startsWith("/")) return;

    const menuItem = getSlashCommandMenuItem();
    if (!menuItem) return;

    // Intercept Enter before Roam handles it as "split block", then trigger the selected slash item.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    activateSlashCommandMenuItem(menuItem);
  };

  document.addEventListener("keydown", onKeyDown, true);
  cleanupFns.push(() => document.removeEventListener("keydown", onKeyDown, true));
}

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
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
    }
    .rm-block-main {
      position: relative;
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
    installSlashCommandEnterGuard();

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

    // Helper to open the publish overlay for a given block
    function openOverlay(blockUid: string, target: "all" | PlatformId) {
      const blockEl = document.querySelector(`[id$="${blockUid}"]`);
      if (!blockEl) return;
      const mainEl = blockEl.closest(".rm-block-main") || blockEl;
      const cls = `smp-overlay-${target === "all" ? "publish" : target}`;
      let overlay = mainEl.querySelector(`.${cls}`);
      if (!overlay) {
        overlay = document.createElement("span");
        overlay.className = cls;
        mainEl.appendChild(overlay);
      }
      renderPublishOverlay({
        parent: overlay as HTMLSpanElement,
        blockUid,
        extensionAPI,
        target,
      });
    }

    // Register command palette commands
    const commands: { label: string; target: "all" | PlatformId }[] = [
      { label: "SMP: Publish to all platforms", target: "all" },
      { label: "SMP: Publish to Twitter/X", target: "twitter" },
      { label: "SMP: Publish to Bluesky", target: "bluesky" },
      { label: "SMP: Publish to LessWrong", target: "lesswrong" },
    ];
    for (const cmd of commands) {
      extensionAPI.ui.commandPalette.addCommand({
        label: cmd.label,
        callback: () => {
          const focused = window.roamAlphaAPI.ui.getFocusedBlock();
          if (!focused) return;
          openOverlay(focused["block-uid"], cmd.target);
        },
      });
    }

    // Register block context menu command
    window.roamAlphaAPI.ui.blockContextMenu.addCommand({
      label: "Publish to Social Media",
      callback: (context: { "block-uid": string }) => {
        openOverlay(context["block-uid"], "all");
      },
    });

    // Register slash commands to insert {{command}} and focus child block
    for (const sc of SLASH_COMMANDS) {
      window.roamAlphaAPI.ui.slashCommand.addCommand({
        label: sc.label,
        callback: (context: { "block-uid": string }) => {
          const blockUid = context["block-uid"];
          // Defer child block creation to avoid racing with Roam's slash command handling
          setTimeout(async () => {
            await window.roamAlphaAPI.updateBlock({
              block: { uid: blockUid, string: `{{[[${sc.buttonText}]]}}` },
            });
            const childUid = window.roamAlphaAPI.util.generateUID();
            await window.roamAlphaAPI.createBlock({
              location: { "parent-uid": blockUid, order: 0 },
              block: { uid: childUid, string: "" },
            });
            await window.roamAlphaAPI.ui.setBlockFocusAndSelection({
              location: { "block-uid": childUid, "window-id": "main-window" },
            });
          }, 50);
          return null;
        },
      });
    }

    // Watch for {{publish}}, {{tweet}}, {{bsky}}, {{lesswrong}} buttons
    for (const { command, target } of BUTTON_COMMANDS) {
      createButtonObserver(command, target, extensionAPI);
    }
  },

  onunload: () => {
    // Clean up observers
    observers.forEach((o) => o.disconnect());
    observers.length = 0;
    cleanupFns.forEach((cleanup) => cleanup());
    cleanupFns.length = 0;

    // Clean up styles
    styleEl.forEach((s) => s.remove());
    styleEl.length = 0;

    // Remove command palette commands
    for (const label of [
      "SMP: Publish to all platforms",
      "SMP: Publish to Twitter/X",
      "SMP: Publish to Bluesky",
      "SMP: Publish to LessWrong",
    ]) {
      window.roamAlphaAPI.ui.commandPalette?.removeCommand?.({ label });
    }

    // Remove slash commands
    for (const label of ["Tweet", "Bluesky Post", "LessWrong Post", "Publish to All"]) {
      window.roamAlphaAPI.ui.slashCommand?.removeCommand?.({ label });
    }

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
