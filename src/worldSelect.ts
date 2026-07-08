import { WORLD_CONFIGS, WorldId } from "./worldTypes";

const WORLD_ORDER: WorldId[] = ["desert", "forest", "enduro", "quarry", "drift"];

export function showWorldSelect(): Promise<WorldId> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "world-select";
    overlay.innerHTML = `
      <div class="ws-inner">
        <h1 class="ws-title">CHOOSE YOUR WORLD</h1>
        <p class="ws-subtitle">Where do you want to race?</p>
        <div class="ws-cards">
          ${WORLD_ORDER.map((id) => {
            const w = WORLD_CONFIGS[id];
            return `
              <button type="button" class="ws-card" data-world="${id}">
                <span class="ws-icon">${w.icon}</span>
                <span class="ws-name">${w.name}</span>
                <span class="ws-desc">${w.description}</span>
              </button>`;
          }).join("")}
        </div>
      </div>`;

    document.body.classList.add("menu-open");
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-world]");
      if (!target) return;
      const id = target.dataset.world as WorldId;
      if (!WORLD_CONFIGS[id]) return;

      e.preventDefault();
      e.stopPropagation();
      overlay.classList.add("ws-fade-out");
      resolve(id);
      overlay.addEventListener("transitionend", () => {
        overlay.remove();
        document.body.classList.remove("menu-open");
      }, { once: true });
    });
  });
}
