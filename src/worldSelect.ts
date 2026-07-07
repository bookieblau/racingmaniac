import { WORLD_CONFIGS, WorldId } from "./worldTypes";

export function showWorldSelect(): Promise<WorldId> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "world-select";
    overlay.innerHTML = `
      <div class="g-inner">
        <h1 class="g-title">RACING MANIAC</h1>
        <p class="g-subtitle">Choose Your World</p>
        <div class="g-cards">
          ${(["desert", "city"] as WorldId[]).map((id) => {
            const w = WORLD_CONFIGS[id];
            return `
            <div class="g-card g-world-card" data-world="${id}">
              <div class="g-card-header g-world-header">
                <span class="g-icon">${w.icon}</span>
                <span class="g-car-name">${w.name}</span>
              </div>
              <div class="g-card-body">
                <p class="g-desc">${w.description}</p>
                <button class="g-drive-btn" data-world="${id}">GO!</button>
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-world]");
      if (!target) return;
      const id = target.dataset.world as WorldId;
      if (!WORLD_CONFIGS[id]) return;

      overlay.classList.add("g-fade-out");
      overlay.addEventListener("transitionend", () => {
        overlay.remove();
        resolve(id);
      }, { once: true });
    });
  });
}
