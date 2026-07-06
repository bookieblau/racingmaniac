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
    this.wireTouchButtons();
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

  // ── On-screen touch buttons ────────────────────────────────────────────────
  // Any element with data-action="forward|backward|left|right" is wired up.
  // Touch events are used on mobile; mouse events allow desktop testing.

  private wireTouchButtons(): void {
    const VALID: Record<string, true> = { forward: true, backward: true, left: true, right: true };

    document.querySelectorAll<HTMLElement>("[data-action]").forEach((el) => {
      const raw = el.dataset["action"] ?? "";
      if (!VALID[raw]) return;
      const action = raw as DriveAction;

      const press   = (): void => { this.active.add(action);    el.classList.add("pressed"); };
      const release = (): void => { this.active.delete(action); el.classList.remove("pressed"); };

      // Touch — preventDefault stops the 300 ms click delay and scroll interference
      el.addEventListener("touchstart",  (e) => { e.preventDefault(); press(); },   { passive: false });
      el.addEventListener("touchend",    (e) => { e.preventDefault(); release(); }, { passive: false });
      el.addEventListener("touchcancel", () => release());

      // Mouse fallback (handy for desktop testing of the on-screen buttons)
      el.addEventListener("mousedown",  press);
      el.addEventListener("mouseup",    release);
      el.addEventListener("mouseleave", release);
    });
  }
}
