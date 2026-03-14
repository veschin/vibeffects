import { AbsoluteFill } from "remotion";
import type { VideoSpec } from "./engine/types";

export const MainVideo: React.FC<Record<string, unknown>> = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a12", color: "#ffffff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <h1 style={{ fontSize: 72, fontFamily: "sans-serif" }}>vibeffects v2</h1>
      </div>
    </AbsoluteFill>
  );
};
