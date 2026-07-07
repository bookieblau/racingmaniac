import {
  Color3,
  DirectionalLight,
  Engine,
  FreeCamera,
  HemisphericLight,
  Scene,
  Vector3,
} from "@babylonjs/core";
import { ChaseCamera } from "./camera";
import { Car } from "./car";
import { CarConfig } from "./carTypes";
import { Hud } from "./hud";
import { InputManager } from "./input";
import {
  getSunDirection,
  HEMI_INTENSITY,
  SUN_INTENSITY,
} from "./lighting";
import { DustSystem } from "./dust";
import { showGarage } from "./garage";
import { CAR_CONFIGS } from "./carTypes";
import {
  DESERT_HEMI_DIFFUSE,
  DESERT_HEMI_GROUND,
  DESERT_SUN_DIFFUSE,
  DESERT_SUN_SPECULAR,
  setupDesertWorld,
} from "./worlds/desertWorld";

function showError(message: string): void {
  const element = document.getElementById("error");
  if (element) {
    element.style.display = "block";
    element.textContent = message;
  }
}

function startGame(carConfig: CarConfig): void {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("Missing #renderCanvas");

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    adaptToDeviceRatio: true,
  });

  if (!engine.webGLVersion) throw new Error("WebGL is not available in this browser.");

  const scene = new Scene(engine);
  setupDesertWorld(scene);

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = HEMI_INTENSITY;
  hemi.groundColor = DESERT_HEMI_GROUND;
  hemi.diffuse = DESERT_HEMI_DIFFUSE;

  const sun = new DirectionalLight("sun", getSunDirection(), scene);
  sun.intensity = SUN_INTENSITY;
  sun.diffuse = DESERT_SUN_DIFFUSE;
  sun.specular = DESERT_SUN_SPECULAR;

  const car = new Car(scene, carConfig);

  const camera = new FreeCamera("followCam", new Vector3(0, 6, -13), scene);
  camera.minZ = 0.1;
  scene.activeCamera = camera;

  const chaseCamera = new ChaseCamera(camera, car);
  const input = new InputManager();
  input.arm();
  const hud   = new Hud();
  const dust  = new DustSystem(scene);

  hud.setCarName(carConfig.name);

  // ── In-game car swap ──────────────────────────────────────────────────────
  let activeCar = car;
  let swapping = false;

  const changeCarBtn = document.getElementById("change-car-btn");
  if (changeCarBtn) {
    changeCarBtn.addEventListener("click", () => {
      if (swapping) return;
      swapping = true;
      input.arm();
      const state = activeCar.getState();
      showGarage().then((newId) => {
        const oldCar = activeCar;
        activeCar = new Car(scene, CAR_CONFIGS[newId], state);
        oldCar.dispose();
        chaseCamera.reset(activeCar);
        input.arm();
        hud.setCarName(CAR_CONFIGS[newId].name);
        swapping = false;
      }).catch(console.error);
    });
  }

  engine.runRenderLoop(() => {
    const deltaSeconds = engine.getDeltaTime() / 1000;
    activeCar.update(deltaSeconds, input);
    chaseCamera.update(activeCar, deltaSeconds);
    hud.update(activeCar);
    dust.update(activeCar);
    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());
  engine.resize();
}

async function runApp(): Promise<void> {
  try {
    const carTypeId = await showGarage();
    startGame(CAR_CONFIGS[carTypeId]);
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
