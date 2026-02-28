import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import SettingsButton from "@/components/SettingsButton";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Matchbook",
  description: "Tennis match logger & scouting tool",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Matchbook",
  },
  icons: {
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
      </head>
      <body className={dmSans.className}>
        <SettingsButton />
        {children}
      </body>
    </html>
  );
}
