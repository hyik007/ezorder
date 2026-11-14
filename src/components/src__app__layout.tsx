import type { Metadata, Viewport } from "next";
// Inter is the typeface of FeedMe's design system. Bundled with the app, so there is no
// font download from another site on restaurant Wi-Fi.
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "EZorder",
  description: "One table QR code. A Big Photos Menu for elderly diners, the Normal Menu for everyone else.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Use the whole screen on phones with notches; content is kept clear with safe-area padding.
  viewportFit: "cover",
  themeColor: "#ff7823",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
