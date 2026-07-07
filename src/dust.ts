import {
  Color4,
  DynamicTexture,
  ParticleSystem,
  Scene,
  Vector3,
} from "@babylonjs/core";
import type { Car } from "./car";

export class DustSystem {
  private readonly systems: ParticleSystem[];
  private readonly emitters: Vector3[];

  constructor(scene: Scene) {
    const tex = makeDustTexture(scene);
    this.emitters = [
      new Vector3(), new Vector3(), new Vector3(), new Vector3(),
    ];
    this.systems = this.emitters.map((em, i) =>
      makeParticleSystem(`dust${i}`, em, tex, scene),
    );
  }

  update(car: Car): void {
    const wheels = car.getWheelWorldPositions();
    const speed  = car.getSpeed();
    const rate   = car.isAirborne() ? 0 : Math.min(70, speed * 4);

    // Spray direction: backward from car heading with upward spread
    const h  = car.getHeading();
    const bx = -Math.sin(h);
    const bz = -Math.cos(h);

    for (let i = 0; i < this.systems.length; i++) {
      if (i >= wheels.length) {
        this.systems[i].emitRate = 0;
        continue;
      }
      this.emitters[i].copyFrom(wheels[i]!);
      this.systems[i].emitRate = rate;
      this.systems[i].direction1.set(bx * 2.5 - 1.0, 0.4, bz * 2.5 - 1.0);
      this.systems[i].direction2.set(bx * 2.5 + 1.0, 3.5, bz * 2.5 + 1.0);
    }
  }
}

function makeDustTexture(scene: Scene): DynamicTexture {
  const SIZE = 32;
  const tex  = new DynamicTexture("dustTex", { width: SIZE, height: SIZE }, scene, false);
  const ctx  = tex.getContext() as CanvasRenderingContext2D;
  const half = SIZE / 2;
  const grd  = ctx.createRadialGradient(half, half, 1, half, half, half - 2);
  grd.addColorStop(0, "rgba(210,178,118,0.95)");
  grd.addColorStop(1, "rgba(210,178,118,0)");
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
  const ps = new ParticleSystem(name, 60, scene);
  ps.particleTexture = tex;
  ps.emitter         = emitter;
  ps.emitRate        = 0;

  // Small spread box around the wheel contact point
  ps.minEmitBox = new Vector3(-0.12, 0,    -0.12);
  ps.maxEmitBox = new Vector3( 0.12, 0.05,  0.12);

  ps.color1    = new Color4(0.90, 0.76, 0.52, 0.80);
  ps.color2    = new Color4(0.76, 0.63, 0.40, 0.60);
  ps.colorDead = new Color4(0.65, 0.52, 0.35, 0);

  ps.minSize     = 0.06;
  ps.maxSize     = 0.26;
  ps.minLifeTime = 0.20;
  ps.maxLifeTime = 0.60;
  ps.minEmitPower = 0.8;
  ps.maxEmitPower = 2.8;
  ps.updateSpeed  = 0.016;

  ps.gravity    = new Vector3(0, -4, 0);
  ps.direction1 = new Vector3(-1, 1, -1);
  ps.direction2 = new Vector3( 1, 3,  1);

  ps.minAngularSpeed = 0;
  ps.maxAngularSpeed = Math.PI;
  ps.blendMode       = ParticleSystem.BLENDMODE_STANDARD;

  ps.start();
  return ps;
}
