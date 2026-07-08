export type WorldId = "desert" | "forest" | "enduro" | "quarry" | "drift";

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
  forest: {
    id: "forest",
    name: "Forest",
    description: "Woodland trails — stay on the path, dodge the trees",
    icon: "🌲",
  },
  enduro: {
    id: "enduro",
    name: "Enduro Loop",
    description: "Mixed off-road lap — dirt, forest, hill, rocks & mud",
    icon: "🏁",
  },
  quarry: {
    id: "quarry",
    name: "Wern Ddu Quarry",
    description: "Hard enduro quarry — bikes only, marked course",
    icon: "⛰️",
  },
  drift: {
    id: "drift",
    name: "Drift Arena",
    description: "Huge flat asphalt lot — build speed, slide, and hit the jumps",
    icon: "💨",
  },
};
