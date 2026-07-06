const KEY_MAP: Record<string, DriveAction | undefined> = {
  ArrowUp: "forward",
  ArrowDown: "backward",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "forward",
  W: "forward",
  s: "backward",
  S: "backward",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
};

export type DriveAction = "forward" | "backward" | "left" | "right";

export class InputManager {
  private readonly active = new Set<DriveAction>();

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  isActive(action: DriveAction): boolean {
    return this.active.has(action);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const action = KEY_MAP[event.key];
    if (!action) {
      return;
    }
    this.active.add(action);
    event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_MAP[event.key];
    if (!action) {
      return;
    }
    this.active.delete(action);
    event.preventDefault();
  };

  private readonly onBlur = (): void => {
    this.active.clear();
  };
}
