import { Composition } from "remotion";
import { MainVideo } from "./Composition";
import type { VideoSpec } from "./engine/types";

export const Root: React.FC = () => {
  return (
    <Composition
      id="Main"
      component={MainVideo}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{} as VideoSpec}
    />
  );
};
