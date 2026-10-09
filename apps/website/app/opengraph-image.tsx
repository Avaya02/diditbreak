import { ImageResponse } from "next/og";

export const alt = "Did your CLAUDE.md edit break your agent? diditbreak measures it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const rows: Array<[string, string, string]> = [
  ["−", "cost/run    $0.049", ""],
  ["+", "cost/run    $0.067", "+36%"],
  ["+", "ran         npm install --save-dev jest", "broke a rule"]
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0a0a0a",
          color: "#ededed"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, letterSpacing: -0.5 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ width: 34, height: 11, border: "2.5px solid #ededed", borderRadius: 3 }} />
            <div style={{ width: 36, height: 14, background: "#ededed", borderRadius: 3 }} />
          </div>
          diditbreak
        </div>

        <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3, maxWidth: 1000 }}>
          Did your CLAUDE.md edit break your agent?
        </div>

        <div style={{ display: "flex", flexDirection: "column", border: "1.5px solid #333", borderRadius: 14, overflow: "hidden" }}>
          {rows.map(([marker, text, aside]) => (
            <div
              key={text}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "12px 24px",
                fontSize: 26,
                background: marker === "+" ? "#1c1c1c" : "#121212",
                color: marker === "+" ? "#ededed" : "#9a9a9a",
                fontFamily: "monospace"
              }}
            >
              <span style={{ width: 18 }}>{marker}</span>
              <span style={{ flex: 1 }}>{text}</span>
              <span style={{ fontWeight: 700, color: "#ededed" }}>{aside}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
