import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
  VertexBuffer,
} from "@babylonjs/core";
import { Car } from "./car";
import { InputManager } from "./input";
import {
  TERRAIN_SIZE,
  TERRAIN_SUBDIVISIONS,
  terrainHeight,
} from "./terrain";

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
  scene.clearColor = new Color4(0.53, 0.68, 0.92, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.86, 0.72, 0.48);
  scene.fogDensity = 0.0045;

  new HemisphericLight("hemi", new Vector3(0, 1, 0), scene).intensity = 0.55;

  const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.3), scene);
  sun.intensity = 1.1;

  createDesertTerrain(scene);

  const car = new Car(scene);
  styleCar(car.mesh, scene);

  const camera = new ArcRotateCamera(
    "followCam",
    -Math.PI / 2,
    Math.PI / 3.2,
    18,
    new Vector3(0, 1, 0),
    scene,
  );
  camera.attachControl(canvas, false);
  camera.minZ = 0.1;
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 28;
  scene.activeCamera = camera;

  const input = new InputManager();

  engine.runRenderLoop(() => {
    const deltaSeconds = engine.getDeltaTime() / 1000;
    car.update(deltaSeconds, input);
    updateCamera(camera, car);
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

function createDesertTerrain(scene: Scene): Mesh {
  const ground = MeshBuilder.CreateGround(
    "desert",
    { width: TERRAIN_SIZE, height: TERRAIN_SIZE, subdivisions: TERRAIN_SUBDIVISIONS },
    scene,
  );

  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) {
    throw new Error("Terrain mesh has no positions");
  }

  const half = TERRAIN_SIZE / 2;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]! - half;
    const z = positions[i + 2]! - half;
    positions[i + 1] = terrainHeight(x, z);
  }

  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  ground.createNormals(true);
  ground.refreshBoundingInfo(true);

  const sand = new StandardMaterial("sand", scene);
  sand.diffuseColor = new Color3(0.82, 0.67, 0.4);
  sand.specularColor = new Color3(0.08, 0.08, 0.08);
  sand.emissiveColor = new Color3(0.04, 0.03, 0.01);
  ground.material = sand;

  return ground;
}

function styleCar(carMesh: Mesh, scene: Scene): void {
  const body = new StandardMaterial("carBody", scene);
  body.diffuseColor = new Color3(0.78, 0.16, 0.12);
  body.specularColor = new Color3(0.25, 0.25, 0.25);
  carMesh.material = body;
}

function updateCamera(camera: ArcRotateCamera, car: Car): void {
  const carPosition = car.getWorldPosition();
  camera.setTarget(carPosition.add(new Vector3(0, 1.2, 0)));
}
