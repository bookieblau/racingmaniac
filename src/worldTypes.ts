export type WorldId = "desert" | "city";

export interface WorldConfig {
  id: WorldId;
  name: string;
  description: string;
  icon: string;
}

export const WORLD_CONFIGS: Record<WorldId, WorldConfig> = {
  desert: {
    id: "desert",
    name: "Desert",
    description: "Bumpy dunes, mesas, and wide open sand",
    icon: "🏜️",
  },
  city: {
    id: "city",
    name: "City",
    description: "Grid streets, skyscrapers, and urban cruising",
    icon: "🏙️",
  },
};
