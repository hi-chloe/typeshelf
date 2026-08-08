import { Providers } from "@/components/Providers";
import { LIBRARY_PREFS_KEY } from "@/lib/libraryPersistence";
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

export const metadata: Metadata = {
  title: "Typeshelf",
  description: "Browse and preview local fonts on your shelf",
};

const themeBootScript = getThemeBootScript(LIBRARY_PREFS_KEY);

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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
