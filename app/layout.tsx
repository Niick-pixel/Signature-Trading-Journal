import { THEME_BOOTSTRAP } from '@/lib/themes';
import type { Metadata } from 'next';
import './globals.css';
import { BottomLeftControls } from '@/components/shell/SettingsPanel';
import { PreferencesProvider } from '@/components/shell/PreferencesProvider';
import { NewTradeButton } from '@/components/shell/NewTradeButton';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { MorningCheckIn } from '@/components/shell/MorningCheckIn';
import { Shortcuts } from '@/components/shell/Shortcuts';

export const metadata: Metadata = {
  title: 'Signature',
  description: 'Local-only iFVG trade journal.',
};

/*
  THEME_BOOTSTRAP (lib/themes) runs before first paint, so a dark theme never
  flashes cream and a light one never flashes dark. The OS setting is
  deliberately ignored: the app opens the way you left it.
*/
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The bootstrap script below sets data-theme before React hydrates, which
    // is by definition a server/client mismatch on this one element.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <PreferencesProvider>
          {children}
          {/* Theme above settings, bottom-left, on every screen. */}
          <BottomLeftControls>
            <ThemeToggle />
          </BottomLeftControls>
          <NewTradeButton />
          <MorningCheckIn />
          <Shortcuts />
        </PreferencesProvider>
      </body>
    </html>
  );
}
