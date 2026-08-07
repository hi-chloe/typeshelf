import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Font Explorer",
  description: "Browse and preview local fonts",
};

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Font Explorer</h1>
    </main>
  );
}
