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

const ARM_DELAY_MS = 600;

export class InputManager {
  private readonly active = new Set<DriveAction>();
  private enabled = false;
  private armTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    this.wireTouchButtons();
  }

  isActive(action: DriveAction): boolean {
    return this.enabled && this.active.has(action);
  }

  /** Drop all held inputs — call after menus close to prevent stuck keys/buttons. */
  clear(): void {
    this.active.clear();
    document.querySelectorAll<HTMLElement>(".touch-btn.pressed").forEach((el) => {
      el.classList.remove("pressed");
    });
  }

  /**
   * Re-enable driving input after a short delay so menu taps cannot leak
   * through to steering / throttle controls underneath.
   */
  arm(): void {
    this.enabled = false;
    this.clear();
    if (this.armTimer !== null) clearTimeout(this.armTimer);
    this.armTimer = setTimeout(() => {
      this.clear();
      this.enabled = true;
      this.armTimer = null;
    }, ARM_DELAY_MS);
  }

  dispose(): void {
    if (this.armTimer !== null) clearTimeout(this.armTimer);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;
    const action = KEY_MAP[event.key];
    if (!action) return;
    this.active.add(action);
    event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_MAP[event.key];
    if (!action) return;
    this.active.delete(action);
    if (this.enabled) event.preventDefault();
  };

  private readonly onBlur = (): void => {
    this.clear();
  };

  private readonly onPointerUp = (): void => {
    if (!this.enabled) this.clear();
  };

  // ── On-screen touch buttons ────────────────────────────────────────────────

  private wireTouchButtons(): void {
    const VALID: Record<string, true> = { forward: true, backward: true, left: true, right: true };

    document.querySelectorAll<HTMLElement>("[data-action]").forEach((el) => {
      const raw = el.dataset["action"] ?? "";
      if (!VALID[raw]) return;
      const action = raw as DriveAction;

      const press = (e: PointerEvent): void => {
        if (!this.enabled) return;
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        this.active.add(action);
        el.classList.add("pressed");
      };

      const release = (e: PointerEvent): void => {
        if (el.hasPointerCapture(e.pointerId)) {
          el.releasePointerCapture(e.pointerId);
        }
        this.active.delete(action);
        el.classList.remove("pressed");
      };

      el.addEventListener("pointerdown", press);
      el.addEventListener("pointerup", release);
      el.addEventListener("pointercancel", release);
      el.addEventListener("lostpointercapture", () => {
        this.active.delete(action);
        el.classList.remove("pressed");
      });
    });
  }
}
