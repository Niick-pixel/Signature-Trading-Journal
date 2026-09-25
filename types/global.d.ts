export {};

declare global {
  interface Window {
    /** Set once the first page has hydrated; see CountUp. */
    __signatureHydrated?: boolean;
    /** Injected by electron/preload.js. Absent when running in a browser. */
    signature?: {
      isDesktop: true;
      platform: NodeJS.Platform;
      /** The window-button strip's colours; a bare 'light' | 'dark' still works. */
      setTitleBarTheme: (theme: 'light' | 'dark' | { color: string; symbolColor: string }) => void;
      openDataFolder: () => Promise<string>;
      onNavigate: (handler: (route: string) => void) => () => void;
    };
  }
}
