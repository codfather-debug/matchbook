import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: 32,
          height: 32,
          borderRadius: "50%",
          backgroundColor: "#c8e245",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Top seam arc */}
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 1,
            width: 30,
            height: 9,
            borderTop: "2.5px solid white",
            borderLeft: "2.5px solid white",
            borderRight: "2.5px solid white",
            borderRadius: "50%",
          }}
        />
        {/* Bottom seam arc */}
        <div
          style={{
            position: "absolute",
            bottom: 4,
            left: 1,
            width: 30,
            height: 9,
            borderBottom: "2.5px solid white",
            borderLeft: "2.5px solid white",
            borderRight: "2.5px solid white",
            borderRadius: "50%",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
