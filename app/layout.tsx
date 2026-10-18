import "./globals.css";
import type { Metadata, Viewport } from "next";
import { TourHost } from "@/components/Tour";
import { HelpHost } from "@/components/HelpButton";

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
  themeColor: "#00205b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap"
        />
      </head>
      <body>{children}<TourHost /><HelpHost /></body>
    </html>
  );
}
