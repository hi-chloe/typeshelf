"use client";

/**
 * Last-resort boundary: catches throws in the root layout itself, where
 * app/error.tsx cannot help because the layout never mounted.
 *
 * This file must render its own <html> and <body>. It also cannot rely on the
 * theme tokens from globals.css — if the layout failed, the boot script that
 * sets data-scheme / data-mode may never have run. Colors here are therefore
 * intentionally hardcoded and theme-independent. This is the one file in the
 * codebase exempt from the tokens-only rule.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#fdfcfa",
          color: "#2b2622",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: "28rem",
            border: "1px solid #8f877f",
            borderRadius: "0.75rem",
            padding: "1.25rem",
            background: "#fffefd",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Typeshelf failed to start</h1>
          <p style={{ fontSize: "0.875rem", color: "#6f655e", marginTop: "0.5rem" }}>
            The app crashed before it could load. Reloading usually clears it.
          </p>
          {error.digest ? (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#855a1c",
                fontFamily: "ui-monospace, monospace",
                marginTop: "0.75rem",
              }}
            >
              Error digest: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1rem",
              background: "#9c4336",
              color: "#ffffff",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.5rem 0.875rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
