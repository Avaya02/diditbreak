import type { Metadata, Viewport } from "next";
import { Archivo, Martian_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { MotionRoot } from "@/components/MotionRoot";

import "./globals.css";

const sans = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-sans",
  display: "swap"
});

const mono = Martian_Mono({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-mono",
  display: "swap"
});

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const description =
  "diditbreak runs your real tasks with Claude Code before and after a CLAUDE.md change, in disposable git sandboxes, and shows what changed: success, cost, and the rules your agent broke.";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "diditbreak: did your CLAUDE.md edit break your agent?",
  description,
  applicationName: "diditbreak",
  keywords: ["CLAUDE.md", "AGENTS.md", "Claude Code", "coding agent", "agent context", "evals", "skills"],
  openGraph: {
    title: "Did your CLAUDE.md edit break your agent?",
    description,
    type: "website",
    siteName: "diditbreak"
  },
  twitter: {
    card: "summary_large_image",
    title: "Did your CLAUDE.md edit break your agent?",
    description
  }
};

/**
 * Runs before first paint: with motion allowed, content that animates in can
 * start from its "before" state instead of flashing in its final one.
 */
const MOTION_FLAG =
  'try{if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("motion")}catch(e){}';

export const viewport: Viewport = {
  themeColor: "#f5f5f5",
  colorScheme: "light dark"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_FLAG }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <MotionRoot />
        {children}
      </body>
    </html>
  );
}
