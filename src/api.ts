/*
 * The extension API, resolved once.
 *
 * Never reference `browser` directly anywhere else: Firefox has the promise-based `browser`
 * namespace and Chrome does not, and keeping that difference to this one line is what keeps a
 * Chromium port to a single manifest file (ADR 0013).
 *
 * Typed by hand rather than by pulling in @types/firefox-webext-browser: this is the whole surface
 * demoIt uses, and writing it out keeps that honest.
 */

export interface StorageChange {
  readonly oldValue?: unknown;
  readonly newValue?: unknown;
}

export interface ExtensionApi {
  readonly storage: {
    readonly local: {
      get(keys?: string | readonly string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | readonly string[]): Promise<void>;
    };
    readonly onChanged: {
      addListener(
        listener: (changes: Record<string, StorageChange>, area: string) => void,
      ): void;
    };
  };
  readonly runtime: {
    getURL(path: string): string;
  };
  readonly action: {
    setBadgeText(details: { text: string }): void;
    setBadgeBackgroundColor(details: { color: string }): void;
    setTitle(details: { title: string }): void;
    readonly onClicked: {
      addListener(listener: () => void): void;
    };
  };
}

const globals = globalThis as { browser?: ExtensionApi; chrome?: ExtensionApi };

export const api: ExtensionApi = (globals.browser ?? globals.chrome) as ExtensionApi;
