import "./index.css";
import { ThermalTutorialComposition } from "./Composition";
import { HardwareLinkageComposition } from "./HardwareTutorial";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <ThermalTutorialComposition />
      <HardwareLinkageComposition />
    </>
  );
};
