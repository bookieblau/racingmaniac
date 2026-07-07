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
import { Hud } from "./hud";
import { InputManager } from "./input";
import {
  configureSceneAtmosphere,
  getSunDirection,
  HEMI_INTENSITY,
  SUN_INTENSITY,
} from "./lighting";
import { createDesertSky } from "./sky";
import { createDesertTerrain } from "./terrainMesh";
import { populateWorld } from "./world";
import { TrackSystem } from "./tracks";
import { DustSystem } from "./dust";

function showError(message: string): void {
  const element = document.getElementById("error");
  if (element) {
    element.style.display = "block";
    element.textContent = message;
  }
}

function startGame(): void {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error("Missing #renderCanvas");
  }

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    adaptToDeviceRatio: true,
  });

  if (!engine.webGLVersion) {
    throw new Error("WebGL is not available in this browser.");
  }

  const scene = new Scene(engine);
  configureSceneAtmosphere(scene);

  createDesertSky(scene);

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = HEMI_INTENSITY;
  hemi.groundColor = new Color3(0.55, 0.42, 0.24);
  hemi.diffuse = new Color3(0.92, 0.88, 0.82);

  const sun = new DirectionalLight("sun", getSunDirection(), scene);
  sun.intensity = SUN_INTENSITY;
  sun.diffuse = new Color3(1, 0.94, 0.78);
  sun.specular = new Color3(0.9, 0.85, 0.7);

  createDesertTerrain(scene);
  populateWorld(scene);

  const car = new Car(scene);

  const camera = new FreeCamera("followCam", new Vector3(0, 6, -13), scene);
  camera.minZ = 0.1;
  scene.activeCamera = camera;

  const chaseCamera = new ChaseCamera(camera, car);
  const input  = new InputManager();
  const hud    = new Hud();
  const tracks = new TrackSystem(scene);
  const dust   = new DustSystem(scene);

  engine.runRenderLoop(() => {
    const deltaSeconds = engine.getDeltaTime() / 1000;
    car.update(deltaSeconds, input);
    chaseCamera.update(car, deltaSeconds);
    hud.update(car);
    tracks.update(car);
    dust.update(car);
    scene.render();
  });

  const resize = (): void => {
    engine.resize();
  };

  window.addEventListener("resize", resize);
  resize();
}

try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      try {
        startGame();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showError(message);
        console.error(error);
      }
    });
  } else {
    startGame();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  showError(message);
  console.error(error);
}
