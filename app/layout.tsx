import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/Providers";
import {
  LEGACY_PREFS_KEYS,
  PREFS_STORAGE_KEY,
} from "@/lib/libraryPersistence";
import { getThemeBootScript } from "@/lib/theme";
import type { Metadata } from "next";
import { Schibsted_Grotesk, Young_Serif } from "next/font/google";
import "./globals.css";

const display = Young_Serif({
  // Young Serif only ships as a single static weight (400) — no variable
  // axis, so next/font/google requires this explicitly.
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

const sans = Schibsted_Grotesk({
  variable: "--font-ui",
  subsets: ["latin"],
});

/**
 * metadataBase drives absolute URLs for the generated Open Graph card.
 * Set NEXT_PUBLIC_SITE_URL in the deployment; localhost is only a dev fallback.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Typeshelf";
const description =
  "Browse and preview your fonts entirely in the browser. Nothing is uploaded anywhere.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s · Typeshelf" },
  description,
  applicationName: title,
  openGraph: {
    type: "website",
    siteName: title,
    title,
    description,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const themeBootScript = getThemeBootScript([
  PREFS_STORAGE_KEY,
  ...LEGACY_PREFS_KEYS,
]);

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scheme="ember"
      data-mode="light"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <head>
        {/*
          Blocking inline script — Next.js “Preventing Flash” guide:
          https://nextjs.org/docs/app/guides/preventing-flash-before-hydration
          Reads localStorage and sets data-scheme / data-mode before first paint.
        */}
        <script
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
        />
      </head>
      <body className="min-h-full font-[family-name:var(--font-ui)]">
        <a
          href="#preview-pane"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:bg-[var(--surface)] focus:p-3 focus:text-sm focus:font-medium focus:text-[var(--ink)] focus:outline focus:outline-[var(--border)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]"
        >
          Skip to preview
        </a>
        <a
          href="#library-settings"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:bg-[var(--surface)] focus:p-3 focus:text-sm focus:font-medium focus:text-[var(--ink)] focus:outline focus:outline-[var(--border)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]"
        >
          Skip to settings
        </a>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
