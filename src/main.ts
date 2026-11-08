import {
  Color3,
  DirectionalLight,
  Engine,
  FreeCamera,
  HemisphericLight,
  Scene,
  ShadowGenerator,
  Vector3,
} from "@babylonjs/core";
import { ChaseCamera } from "./camera";
import { Car } from "./car";
import { CarTypeId } from "./carTypes";
import { Hud } from "./hud";
import { InputManager } from "./input";
import {
  getSunDirection,
  HEMI_INTENSITY,
  SUN_INTENSITY,
} from "./lighting";
import { DustSystem } from "./dust";
import { DriftMarksSystem } from "./driftMarks";
import { EngineAudio } from "./engineAudio";
import { showGarage } from "./garage";
import { CAR_CONFIGS } from "./carTypes";
import {
  DESERT_HEMI_DIFFUSE,
  DESERT_HEMI_GROUND,
  DESERT_SUN_DIFFUSE,
  DESERT_SUN_SPECULAR,
} from "./worlds/desertWorld";
import {
  FOREST_HEMI_DIFFUSE,
  FOREST_HEMI_GROUND,
  FOREST_SUN_DIFFUSE,
  FOREST_SUN_SPECULAR,
} from "./worlds/forestWorld";
import { CheckpointSystem } from "./checkpoints";
import {
  buildWorld,
  getRaceCheckpoints,
  getSpawnState,
  isBikesOnlyWorld,
  isRaceWorld,
} from "./worldContext";
import { showWorldSelect } from "./worldSelect";
import type { WorldId } from "./worldTypes";
import {
  ENDURO_HEMI_DIFFUSE,
  ENDURO_HEMI_GROUND,
  ENDURO_SUN_DIFFUSE,
  ENDURO_SUN_SPECULAR,
} from "./worlds/enduroWorld";
import {
  QUARRY_HEMI_DIFFUSE,
  QUARRY_HEMI_GROUND,
  QUARRY_SUN_DIFFUSE,
  QUARRY_SUN_SPECULAR,
} from "./worlds/quarryWorld";
import {
  DRIFT_HEMI_DIFFUSE,
  DRIFT_HEMI_GROUND,
  DRIFT_SUN_DIFFUSE,
  DRIFT_SUN_SPECULAR,
} from "./worlds/driftWorld";
import {
  MOTO_HEMI_DIFFUSE,
  MOTO_HEMI_GROUND,
  MOTO_SUN_DIFFUSE,
  MOTO_SUN_SPECULAR,
} from "./worlds/motoWorld";
import { WORLD_CONFIGS } from "./worldTypes";
import { setupSceneGraphics } from "./sceneGraphics";

interface WorldLighting {
  hemiGround: Color3;
  hemiDiffuse: Color3;
  sunDiffuse: Color3;
  sunSpecular: Color3;
}

const WORLD_LIGHTING: Record<WorldId, WorldLighting> = {
  desert: {
    hemiGround: DESERT_HEMI_GROUND,
    hemiDiffuse: DESERT_HEMI_DIFFUSE,
    sunDiffuse: DESERT_SUN_DIFFUSE,
    sunSpecular: DESERT_SUN_SPECULAR,
  },
  forest: {
    hemiGround: FOREST_HEMI_GROUND,
    hemiDiffuse: FOREST_HEMI_DIFFUSE,
    sunDiffuse: FOREST_SUN_DIFFUSE,
    sunSpecular: FOREST_SUN_SPECULAR,
  },
  enduro: {
    hemiGround: ENDURO_HEMI_GROUND,
    hemiDiffuse: ENDURO_HEMI_DIFFUSE,
    sunDiffuse: ENDURO_SUN_DIFFUSE,
    sunSpecular: ENDURO_SUN_SPECULAR,
  },
  quarry: {
    hemiGround: QUARRY_HEMI_GROUND,
    hemiDiffuse: QUARRY_HEMI_DIFFUSE,
    sunDiffuse: QUARRY_SUN_DIFFUSE,
    sunSpecular: QUARRY_SUN_SPECULAR,
  },
  drift: {
    hemiGround: DRIFT_HEMI_GROUND,
    hemiDiffuse: DRIFT_HEMI_DIFFUSE,
    sunDiffuse: DRIFT_SUN_DIFFUSE,
    sunSpecular: DRIFT_SUN_SPECULAR,
  },
  moto: {
    hemiGround: MOTO_HEMI_GROUND,
    hemiDiffuse: MOTO_HEMI_DIFFUSE,
    sunDiffuse: MOTO_SUN_DIFFUSE,
    sunSpecular: MOTO_SUN_SPECULAR,
  },
};

let currentCarTypeId: CarTypeId = "dirtbike";
let currentWorldId: WorldId = "desert";
let disposeSession: (() => void) | null = null;
let swapping = false;

function showError(message: string): void {
  const element = document.getElementById("error");
  if (element) {
    element.style.display = "block";
    element.textContent = message;
  }
}

interface SessionOptions {
  onCarTypeIdChange: (id: CarTypeId) => void;
}

function createGameSession(
  carTypeId: CarTypeId,
  worldId: WorldId,
  options: SessionOptions,
): () => void {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("Missing #renderCanvas");

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    adaptToDeviceRatio: true,
  });

  if (!engine.webGLVersion) throw new Error("WebGL is not available in this browser.");

  const scene = new Scene(engine);
  buildWorld(scene, worldId);

  const lighting = WORLD_LIGHTING[worldId];

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = HEMI_INTENSITY;
  hemi.groundColor = lighting.hemiGround;
  hemi.diffuse = lighting.hemiDiffuse;

  const sun = new DirectionalLight("sun", getSunDirection(), scene);
  sun.intensity = SUN_INTENSITY;
  sun.diffuse = lighting.sunDiffuse;
  sun.specular = lighting.sunSpecular;
  sun.autoCalcShadowZBounds = true;

  const shadow = new ShadowGenerator(2048, sun);
  shadow.useBlurExponentialShadowMap = true;

  const bindShadowCasters = (vehicle: Car) => {
    for (const mesh of vehicle.root.getChildMeshes(false)) {
      shadow.addShadowCaster(mesh);
    }
  };

  const carConfig = CAR_CONFIGS[carTypeId];
  const car = new Car(scene, carConfig, getSpawnState(worldId));
  bindShadowCasters(car);

  const camera = new FreeCamera("followCam", new Vector3(0, 6, -13), scene);
  camera.minZ = 0.1;
  scene.activeCamera = camera;

  const chaseCamera = new ChaseCamera(camera, car);
  const sceneGraphics = setupSceneGraphics(scene, camera, sun, shadow, worldId);
  const input = new InputManager();
  input.arm();
  const hud = new Hud();
  const dust = new DustSystem(scene);
  const driftMarks = new DriftMarksSystem(scene);
  const engineAudio = new EngineAudio();
  engineAudio.start(carTypeId);

  hud.setCarName(carConfig.name);
  hud.setRaceMode(isRaceWorld(worldId));

  const raceCheckpoints = getRaceCheckpoints(worldId);
  const checkpoints = raceCheckpoints ? new CheckpointSystem(raceCheckpoints) : null;

  let activeCar = car;
  const bikesOnly = isBikesOnlyWorld(worldId);

  const changeCarBtn = document.getElementById("change-car-btn");
  const onChangeCar = () => {
    if (swapping) return;
    swapping = true;
    input.arm();
    const state = activeCar.getState();
    showGarage(
      bikesOnly
        ? {
            bikesOnly: true,
            title: WORLD_CONFIGS[worldId].name.toUpperCase(),
            subtitle: "Bikes only — pick your ride",
          }
        : {},
    ).then((newId) => {
      const oldCar = activeCar;
      activeCar = new Car(scene, CAR_CONFIGS[newId], state);
      bindShadowCasters(activeCar);
      oldCar.dispose();
      chaseCamera.reset(activeCar);
      input.arm();
      hud.setCarName(CAR_CONFIGS[newId].name);
      engineAudio.setVehicle(newId);
      options.onCarTypeIdChange(newId);
      swapping = false;
    }).catch(() => {
      swapping = false;
    });
  };

  if (changeCarBtn) {
    changeCarBtn.addEventListener("click", onChangeCar);
  }

  const renderLoop = () => {
    const deltaSeconds = engine.getDeltaTime() / 1000;
    activeCar.update(deltaSeconds, input);
    const pos = activeCar.getState();
    checkpoints?.update(pos.x, pos.z, deltaSeconds);
    chaseCamera.update(activeCar, deltaSeconds);
    hud.update(activeCar, checkpoints?.getHudState());
    dust.update(activeCar);
    driftMarks.update(activeCar);
    engineAudio.update(activeCar, input);
    scene.render();
  };

  engine.runRenderLoop(renderLoop);

  const onResize = () => engine.resize();
  window.addEventListener("resize", onResize);
  engine.resize();

  return () => {
    if (changeCarBtn) {
      changeCarBtn.removeEventListener("click", onChangeCar);
    }
    engine.stopRenderLoop();
    window.removeEventListener("resize", onResize);
    engineAudio.dispose();
    sceneGraphics.dispose();
    scene.dispose();
    engine.dispose();
  };
}

function launchGame(): void {
  disposeSession?.();
  disposeSession = createGameSession(currentCarTypeId, currentWorldId, {
    onCarTypeIdChange: (id) => {
      currentCarTypeId = id;
    },
  });
}

async function ensureBikeForQuarry(worldId: WorldId, carTypeId: CarTypeId): Promise<CarTypeId> {
  if (isBikesOnlyWorld(worldId) && CAR_CONFIGS[carTypeId].kind !== "bike") {
    return showGarage({
      bikesOnly: true,
      title: WORLD_CONFIGS[worldId].name.toUpperCase(),
      subtitle: "Bikes only — pick your ride",
    });
  }
  return carTypeId;
}

async function switchWorld(): Promise<void> {
  if (swapping) return;
  swapping = true;

  try {
    const newWorldId = await showWorldSelect();
    if (newWorldId === currentWorldId) return;

    currentWorldId = newWorldId;
    currentCarTypeId = await ensureBikeForQuarry(newWorldId, currentCarTypeId);
    launchGame();
  } finally {
    swapping = false;
  }
}

function setupChangeWorldButton(): void {
  const changeWorldBtn = document.getElementById("change-world-btn");
  if (!changeWorldBtn) return;

  changeWorldBtn.addEventListener("click", () => {
    void switchWorld();
  });
}

async function runApp(): Promise<void> {
  try {
    setupChangeWorldButton();

    currentCarTypeId = await showGarage();
    currentWorldId = await showWorldSelect();
    currentCarTypeId = await ensureBikeForQuarry(currentWorldId, currentCarTypeId);

    launchGame();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showError(message);
    console.error(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void runApp());
} else {
  void runApp();
}
