// Roam API types (subset used by this extension)

export interface OnloadArgs {
  extensionAPI: ExtensionAPI;
}

export interface ExtensionAPI {
  settings: {
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => void;
    getAll: () => Record<string, unknown>;
    panel: {
      create: (config: SettingsPanelConfig) => void;
    };
  };
  ui: {
    commandPalette: {
      addCommand: (cmd: { label: string; callback: () => void }) => void;
      removeCommand: (cmd: { label: string }) => void;
    };
  };
}

export interface SettingsPanelConfig {
  tabTitle: string;
  settings: SettingItem[];
}

export interface SettingItem {
  id: string;
  name: string;
  description?: string | React.ReactElement;
  action:
    | { type: "input"; placeholder?: string; onChange?: (evt: { target: { value: string } }) => void }
    | { type: "switch"; onChange?: (evt: { target: { checked: boolean } }) => void }
    | { type: "button"; content: string; onClick: () => void }
    | { type: "select"; items: string[]; onChange?: (evt: { target: { value: string } }) => void }
    | { type: "reactComponent"; component: React.FC };
}

// Block tree from Roam
export interface RoamBlock {
  uid: string;
  text: string;
  children?: RoamBlock[];
}

// Platform types
export type PlatformId = "twitter" | "bluesky" | "lesswrong";

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  charLimit: number | null; // null = no limit
  supportsThreads: boolean;
  icon: string;
}

export interface PostContent {
  blocks: { uid: string; text: string }[];
}

export interface PostResult {
  success: boolean;
  platform: PlatformId;
  url?: string;
  error?: string;
}

export interface PlatformCredentials {
  twitter?: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  };
  bluesky?: {
    handle: string;
    appPassword: string;
  };
  lesswrong?: {
    loginToken: string;
  };
}
