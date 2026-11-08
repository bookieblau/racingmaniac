import {
  Color4,
  DynamicTexture,
  ParticleSystem,
  Scene,
  Vector3,
} from "@babylonjs/core";
import type { Car } from "./car";
import { getSurfaceKind } from "./worldContext";

const SURFACE_STYLES = {
  dirt: {
    c1: [0.90, 0.76, 0.52, 0.80] as const,
    c2: [0.76, 0.63, 0.40, 0.60] as const,
    dead: [0.65, 0.52, 0.35, 0] as const,
    texInner: "rgba(210,178,118,0.95)",
    texOuter: "rgba(210,178,118,0)",
    rateMult: 1,
    sizeMult: 1,
  },
  paved: {
    c1: [0.72, 0.74, 0.78, 0.45] as const,
    c2: [0.55, 0.57, 0.62, 0.28] as const,
    dead: [0.45, 0.47, 0.50, 0] as const,
    texInner: "rgba(180,185,190,0.7)",
    texOuter: "rgba(180,185,190,0)",
    rateMult: 0.22,
    sizeMult: 0.65,
  },
  gravel: {
    c1: [0.62, 0.58, 0.52, 0.75] as const,
    c2: [0.48, 0.44, 0.40, 0.55] as const,
    dead: [0.38, 0.35, 0.32, 0] as const,
    texInner: "rgba(150,142,132,0.9)",
    texOuter: "rgba(150,142,132,0)",
    rateMult: 0.85,
    sizeMult: 0.9,
  },
};

export class DustSystem {
  private readonly systems: ParticleSystem[];
  private readonly emitters: Vector3[];
  private readonly dirtTex: DynamicTexture;
  private readonly pavedTex: DynamicTexture;
  private readonly gravelTex: DynamicTexture;
  private currentKind = getSurfaceKind();

  constructor(scene: Scene) {
    this.dirtTex = makeDustTexture(scene, "dustTexDirt", SURFACE_STYLES.dirt);
    this.pavedTex = makeDustTexture(scene, "dustTexPaved", SURFACE_STYLES.paved);
    this.gravelTex = makeDustTexture(scene, "dustTexGravel", SURFACE_STYLES.gravel);
    this.emitters = [
      new Vector3(), new Vector3(), new Vector3(), new Vector3(),
    ];
    this.systems = this.emitters.map((em, i) =>
      makeParticleSystem(`dust${i}`, em, this.dirtTex, scene),
    );
  }

  update(car: Car): void {
    const kind = getSurfaceKind();
    if (kind !== this.currentKind) {
      this.currentKind = kind;
      const tex = kind === "paved" ? this.pavedTex : kind === "gravel" ? this.gravelTex : this.dirtTex;
      const style = SURFACE_STYLES[kind];
      for (const ps of this.systems) {
        ps.particleTexture = tex;
        ps.color1 = new Color4(...style.c1);
        ps.color2 = new Color4(...style.c2);
        ps.colorDead = new Color4(...style.dead);
      }
    }

    const style = SURFACE_STYLES[kind];
    const wheels = car.getWheelWorldPositions();
    const speed = car.getSpeed();
    const drifting = car.isDrifting();
    const slip = car.getSlipAngle();

    const driftMult = drifting ? 1.6 + Math.abs(slip) * 3.2 : 1;
    let rate = car.isAirborne() ? 0 : Math.min(140, speed * 5 * driftMult) * style.rateMult;
    if (kind === "paved" && !drifting) rate *= 0.35;

    const pathH = car.getVelocityHeading();
    const bx = -Math.sin(pathH);
    const bz = -Math.cos(pathH);
    const sideX = Math.cos(pathH) * Math.sign(slip || 1);
    const sideZ = -Math.sin(pathH) * Math.sign(slip || 1);
    const sidePush = drifting ? 1.4 : 0;

    for (let i = 0; i < this.systems.length; i++) {
      if (i >= wheels.length) {
        this.systems[i].emitRate = 0;
        continue;
      }
      this.emitters[i].copyFrom(wheels[i]!);
      this.systems[i].emitRate = rate;
      this.systems[i].minSize = 0.06 * style.sizeMult;
      this.systems[i].maxSize = 0.30 * style.sizeMult;
      this.systems[i].direction1.set(
        bx * 2.2 - 0.8 + sideX * sidePush,
        0.35,
        bz * 2.2 - 0.8 + sideZ * sidePush,
      );
      this.systems[i].direction2.set(
        bx * 2.8 + 0.8 + sideX * sidePush,
        drifting ? 4.2 : 3.2,
        bz * 2.8 + 0.8 + sideZ * sidePush,
      );
    }
  }
}

function makeDustTexture(
  scene: Scene,
  name: string,
  style: { texInner: string; texOuter: string },
): DynamicTexture {
  const SIZE = 32;
  const tex = new DynamicTexture(name, { width: SIZE, height: SIZE }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const half = SIZE / 2;
  const grd = ctx.createRadialGradient(half, half, 1, half, half, half - 2);
  grd.addColorStop(0, style.texInner);
  grd.addColorStop(1, style.texOuter);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, SIZE, SIZE);
  tex.update();
  return tex;
}

function makeParticleSystem(
  name: string,
  emitter: Vector3,
  tex: DynamicTexture,
  scene: Scene,
): ParticleSystem {
  const ps = new ParticleSystem(name, 80, scene);
  ps.particleTexture = tex;
  ps.emitter = emitter;
  ps.emitRate = 0;

  ps.minEmitBox = new Vector3(-0.14, 0, -0.14);
  ps.maxEmitBox = new Vector3(0.14, 0.06, 0.14);

  ps.color1 = new Color4(0.90, 0.76, 0.52, 0.80);
  ps.color2 = new Color4(0.76, 0.63, 0.40, 0.60);
  ps.colorDead = new Color4(0.65, 0.52, 0.35, 0);

  ps.minSize = 0.06;
  ps.maxSize = 0.30;
  ps.minLifeTime = 0.20;
  ps.maxLifeTime = 0.65;
  ps.minEmitPower = 0.8;
  ps.maxEmitPower = 3.2;
  ps.updateSpeed = 0.016;

  ps.gravity = new Vector3(0, -4, 0);
  ps.direction1 = new Vector3(-1, 1, -1);
  ps.direction2 = new Vector3(1, 3, 1);

  ps.minAngularSpeed = 0;
  ps.maxAngularSpeed = Math.PI;
  ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;

  ps.start();
  return ps;
}
