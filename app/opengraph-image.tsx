import { ImageResponse } from "next/og";

/**
 * Generated social card. Built at request/build time so there's no binary asset
 * to keep in sync with the theme.
 *
 * Colors are hardcoded rather than tokenized: this renders in a Satori context
 * with no CSS custom properties and no stylesheet. Values mirror the ember light
 * palette in app/globals.css — update both together.
 */
export const alt =
  "Typeshelf — browse and preview local fonts, entirely in your browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#fdfcfa",
          color: "#2b2622",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 28,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#9c4336",
            }}
          >
            Typeshelf
          </div>
          <div style={{ fontSize: 82, lineHeight: 1.1, marginTop: 24, maxWidth: 900 }}>
            Browse and preview your fonts
          </div>
          <div style={{ fontSize: 34, color: "#6f655e", marginTop: 24, maxWidth: 860 }}>
            Nothing leaves your browser. Open source, WCAG AA, six themes.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {["#d9614f", "#3d7ecf", "#3d8f5c", "#8b5bb5", "#c44545"].map((c) => (
            <div
              key={c}
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: c,
              }}
            />
          ))}
          <div style={{ fontSize: 26, color: "#6f655e", marginLeft: "auto" }}>
            hichloe.me/typeshelf
          </div>
        </div>
      </div>
    ),
    size,
  );
}
