import type { Checkpoint } from "./enduroTerrain";

export interface RaceHudState {
  checkpoint: number;
  total: number;
  elapsed: string;
  lap: number;
  best: string | null;
  lastLap: string | null;
  finished: boolean;
}

export class CheckpointSystem {
  private index = 0;
  private elapsed = 0;
  private lapCount = 0;
  private bestLap: number | null = null;
  private lastLap: number | null = null;
  private armed = false;

  constructor(private readonly checkpoints: readonly Checkpoint[]) {}

  update(x: number, z: number, deltaSeconds: number): void {
    if (this.checkpoints.length === 0) return;

    if (this.armed) {
      this.elapsed += deltaSeconds;
    }

    const cp = this.checkpoints[this.index];
    if (!cp) return;

    const dist = Math.hypot(x - cp.x, z - cp.z);
    if (dist > cp.radius) return;

    if (!this.armed) {
      this.armed = true;
      this.elapsed = 0;
    }

    this.index++;
    if (this.index >= this.checkpoints.length) {
      this.lastLap = this.elapsed;
      if (this.bestLap === null || this.elapsed < this.bestLap) {
        this.bestLap = this.elapsed;
      }
      this.lapCount++;
      this.index = 0;
      this.elapsed = 0;
    }
  }

  getHudState(): RaceHudState {
    const displayIndex = this.armed
      ? Math.min(this.index + 1, this.checkpoints.length)
      : 1;

    return {
      checkpoint: displayIndex,
      total: this.checkpoints.length,
      elapsed: formatRaceTime(this.elapsed),
      lap: this.lapCount,
      best: this.bestLap === null ? null : formatRaceTime(this.bestLap),
      lastLap: this.lastLap === null ? null : formatRaceTime(this.lastLap),
      finished: this.lapCount > 0,
    };
  }
}

function formatRaceTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const whole = Math.floor(secs);
  const tenths = Math.floor((secs - whole) * 10);
  return `${mins}:${whole.toString().padStart(2, "0")}.${tenths}`;
}
