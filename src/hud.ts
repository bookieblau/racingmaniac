import { Car } from "./car";

/** Speed display uses an arbitrary scale so numbers feel like a speedometer. */
const SPEED_DISPLAY_SCALE = 2.2;

export class Hud {
  private readonly speedElement: HTMLElement;
  private readonly statusElement: HTMLElement;

  constructor() {
    const speedElement = document.getElementById("hud-speed");
    const statusElement = document.getElementById("hud-status");
    if (!speedElement || !statusElement) {
      throw new Error("Missing HUD elements");
    }
    this.speedElement = speedElement;
    this.statusElement = statusElement;
  }

  update(car: Car): void {
    const displaySpeed = Math.round(Math.abs(car.getSpeed()) * SPEED_DISPLAY_SCALE);
    this.speedElement.textContent = String(displaySpeed);

    if (car.isAirborne()) {
      this.statusElement.textContent = "AIR";
      this.statusElement.classList.add("is-air");
    } else {
      this.statusElement.textContent = "GND";
      this.statusElement.classList.remove("is-air");
    }
  }
}
