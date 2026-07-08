import { BIKE_IDS, CAR_CONFIGS, CAR_IDS, CarTypeId } from "./carTypes";

export interface GarageOptions {
  bikesOnly?: boolean;
  title?: string;
  subtitle?: string;
}

const ICONS: Record<CarTypeId, string> = {
  buggy:     "🏎️",
  monster:   "🚛",
  racer:     "⚡",
  crawler:   "🪨",
  dirtbike:  "🏍️",
  sportbike: "🏁",
  chopper:   "🛵",
};

const STAT_COLORS: [string, string, string] = ["#f0c020", "#40c8f0", "#f05030"];

function statBar(label: string, value: number, color: string): string {
  return `
    <div class="g-stat">
      <span class="g-stat-label">${label}</span>
      <div class="g-stat-track">
        <div class="g-stat-fill" style="width:${value}%;background:${color}"></div>
      </div>
    </div>`;
}

function cardHTML(id: CarTypeId): string {
  const c = CAR_CONFIGS[id];
  const btnLabel = c.kind === "bike" ? "RIDE!" : "DRIVE!";
  return `
  <div class="g-card" data-car="${id}">
    <div class="g-card-header" style="background:${c.bodyColorHex}">
      <span class="g-icon">${ICONS[id]}</span>
      <span class="g-car-name">${c.name}</span>
    </div>
    <div class="g-card-body">
      <p class="g-desc">${c.description}</p>
      ${statBar("SPEED",    c.statSpeed,    STAT_COLORS[0])}
      ${statBar("HANDLING", c.statHandling, STAT_COLORS[1])}
      ${statBar("POWER",    c.statPower,    STAT_COLORS[2])}
      <button type="button" class="g-drive-btn" data-car="${id}">${btnLabel}</button>
    </div>
  </div>`;
}

export function showGarage(options: GarageOptions = {}): Promise<CarTypeId> {
  const { bikesOnly = false, title = "RACING MANIAC", subtitle = "Choose Your Ride" } = options;

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "garage";
    overlay.innerHTML = `
      <div class="g-inner">
        <h1 class="g-title">${title}</h1>
        <p class="g-subtitle">${subtitle}</p>
        ${bikesOnly ? "" : `
        <h2 class="g-section">Cars</h2>
        <div class="g-cards">
          ${CAR_IDS.map(cardHTML).join("")}
        </div>`}
        <h2 class="g-section">Motorcycles</h2>
        <div class="g-cards">
          ${BIKE_IDS.map(cardHTML).join("")}
        </div>
      </div>`;
    document.body.classList.add("menu-open");
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-car]");
      if (!target) return;
      const id = target.dataset.car as CarTypeId;
      if (!CAR_CONFIGS[id]) return;
      if (bikesOnly && CAR_CONFIGS[id].kind !== "bike") return;

      e.preventDefault();
      e.stopPropagation();
      overlay.classList.add("g-fade-out");
      resolve(id);
      overlay.addEventListener("transitionend", () => {
        overlay.remove();
        document.body.classList.remove("menu-open");
      }, { once: true });
    });
  });
}
