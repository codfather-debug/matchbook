import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0c0c0e",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "40px",
        }}
      >
        {/* Outer ring */}
        <div
          style={{
            position: "absolute",
            width: 120,
            height: 120,
            borderRadius: "50%",
            border: "5px solid rgba(163,230,53,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        />
        {/* Arc fill */}
        <div
          style={{
            position: "absolute",
            width: 120,
            height: 120,
            borderRadius: "50%",
            border: "5px solid #a3e635",
            borderBottom: "5px solid transparent",
            borderLeft: "5px solid transparent",
            transform: "rotate(-45deg)",
            display: "flex",
          }}
        />
        {/* M letter */}
        <div
          style={{
            color: "#ffffff",
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: "-4px",
            lineHeight: 1,
            display: "flex",
          }}
        >
          M
        </div>
      </div>
    ),
    { ...size }
  );
}
