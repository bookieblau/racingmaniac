import {
  DirectionalLight,
  FreeCamera,
  ImageProcessingConfiguration,
  Scene,
  ShadowGenerator,
} from "@babylonjs/core";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import type { WorldId } from "./worldTypes";

const TERRAIN_CAST =
  /^(motoTrack|desert|drift|forest|enduro|quarry|driftTrack)/;

export interface SceneGraphicsHandle {
  dispose(): void;
}

export function setupSceneGraphics(
  scene: Scene,
  camera: FreeCamera,
  sun: DirectionalLight,
  shadow: ShadowGenerator,
  worldId: WorldId,
): SceneGraphicsHandle {
  scene.autoClear = true;
  scene.autoClearDepthAndStencil = true;

  const ipc = scene.imageProcessingConfiguration;
  ipc.exposure = worldId === "moto" ? 1.14 : 1.1;
  ipc.contrast = 1.12;
  ipc.toneMappingEnabled = true;
  ipc.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ipc.vignetteEnabled = true;
  ipc.vignetteWeight = 0.22;
  ipc.vignetteStretch = 0.45;

  shadow.mapSize = 2048;
  shadow.contactHardeningLightSizeUVRatio = 0.006;
  shadow.darkness = 0.42;
  shadow.blurKernel = 28;

  sun.shadowMinZ = 2;
  sun.shadowMaxZ = 420;
  sun.shadowOrthoScale = worldId === "moto" ? 0.65 : 0.55;

  registerTerrainShadows(scene, shadow);

  let pipeline: DefaultRenderingPipeline | undefined;
  try {
    shadow.useContactHardeningShadow = true;
    pipeline = new DefaultRenderingPipeline("gfx", true, scene, [camera], true);
    pipeline.fxaaEnabled = true;
    pipeline.samples = 1;
    pipeline.sharpenEnabled = true;
    pipeline.sharpen.edgeAmount = 0.25;
    pipeline.sharpen.colorAmount = 1;

    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.82;
    pipeline.bloomWeight = 0.18;
    pipeline.bloomKernel = 48;
    pipeline.bloomScale = 0.55;

    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.exposure = ipc.exposure;
    pipeline.imageProcessing.contrast = ipc.contrast;

    pipeline.chromaticAberrationEnabled = false;
    pipeline.grainEnabled = false;
  } catch (error) {
    console.warn("Post-process pipeline disabled:", error);
    shadow.useContactHardeningShadow = false;
  }

  return {
    dispose() {
      pipeline?.dispose();
    },
  };
}

function registerTerrainShadows(scene: Scene, shadow: ShadowGenerator): void {
  for (const mesh of scene.meshes) {
    if (!TERRAIN_CAST.test(mesh.name)) continue;
    mesh.receiveShadows = true;
    shadow.addShadowCaster(mesh, true);
  }
}
