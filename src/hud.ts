import { Car } from "./car";
import type { RaceHudState } from "./checkpoints";

/** Speed display uses an arbitrary scale so numbers feel like a speedometer. */
const SPEED_DISPLAY_SCALE = 2.2;

export class Hud {
  private readonly speedElement: HTMLElement;
  private readonly statusElement: HTMLElement;
  private readonly titleElement: HTMLElement | null;
  private readonly raceElement: HTMLElement | null;
  private readonly cpElement: HTMLElement | null;
  private readonly timeElement: HTMLElement | null;
  private readonly lapElement: HTMLElement | null;
  private raceMode = false;

  constructor() {
    const speedElement = document.getElementById("hud-speed");
    const statusElement = document.getElementById("hud-status");
    if (!speedElement || !statusElement) {
      throw new Error("Missing HUD elements");
    }
    this.speedElement = speedElement;
    this.statusElement = statusElement;
    this.titleElement = document.getElementById("hud-title");
    this.raceElement = document.getElementById("hud-race");
    this.cpElement = document.getElementById("hud-cp");
    this.timeElement = document.getElementById("hud-time");
    this.lapElement = document.getElementById("hud-lap");
  }

  setCarName(name: string): void {
    if (this.titleElement) this.titleElement.textContent = name;
  }

  setRaceMode(enabled: boolean): void {
    this.raceMode = enabled;
    if (this.raceElement) {
      this.raceElement.style.display = enabled ? "block" : "none";
    }
  }

  update(car: Car, race?: RaceHudState): void {
    const displaySpeed = Math.round(Math.abs(car.getSpeed()) * SPEED_DISPLAY_SCALE);
    this.speedElement.textContent = String(displaySpeed);

    if (car.isAirborne()) {
      this.statusElement.textContent = "AIR";
      this.statusElement.classList.add("is-air");
      this.statusElement.classList.remove("is-drift");
    } else if (car.isDrifting()) {
      this.statusElement.textContent = "DRF";
      this.statusElement.classList.remove("is-air");
      this.statusElement.classList.add("is-drift");
    } else {
      this.statusElement.textContent = "GND";
      this.statusElement.classList.remove("is-air");
      this.statusElement.classList.remove("is-drift");
    }

    if (!this.raceMode || !race) return;

    if (this.cpElement) {
      this.cpElement.textContent = `CP ${race.checkpoint}/${race.total}`;
    }
    if (this.timeElement) {
      const best = race.best ? ` · best ${race.best}` : "";
      this.timeElement.textContent = `${race.elapsed}${best}`;
    }
    if (this.lapElement) {
      const last = race.lastLap ? ` · last ${race.lastLap}` : "";
      this.lapElement.textContent = race.lap > 0 ? `Lap ${race.lap}${last}` : "Follow the course";
    }
  }
}
