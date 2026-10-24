import "./globals.css";
import type { Metadata, Viewport } from "next";
import { TourHost } from "@/components/Tour";
import { HelpHost } from "@/components/HelpButton";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Brainerd Mail",
  description: "Newsletters and texts for Brainerd Baptist ministries",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Brainerd Mail", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)",  color: "#0e1626" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking theme script — must run before any paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}<TourHost /><HelpHost /></body>
    </html>
  );
}
