"use client";

import { FontLibraryProvider } from "@/lib/FontLibraryContext";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <FontLibraryProvider>{children}</FontLibraryProvider>;
}
