import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      // Full-bleed tennis ball — iOS applies its own squircle mask on top
      <div
        style={{
          display: "flex",
          width: 180,
          height: 180,
          backgroundColor: "#c8e245",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Top seam arc */}
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 0,
            width: 180,
            height: 50,
            borderTop: "13px solid rgba(255,255,255,0.9)",
            borderLeft: "13px solid rgba(255,255,255,0.9)",
            borderRight: "13px solid rgba(255,255,255,0.9)",
            borderRadius: "50%",
          }}
        />
        {/* Bottom seam arc */}
        <div
          style={{
            position: "absolute",
            bottom: 22,
            left: 0,
            width: 180,
            height: 50,
            borderBottom: "13px solid rgba(255,255,255,0.9)",
            borderLeft: "13px solid rgba(255,255,255,0.9)",
            borderRight: "13px solid rgba(255,255,255,0.9)",
            borderRadius: "50%",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
