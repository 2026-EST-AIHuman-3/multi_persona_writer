export type ScenarioStage =
  | "DIRECTION_SELECTION"
  | "WORLD_RULE_SELECTION"
  | "PROTAGONIST_SELECTION"
  | "ANTAGONIST_SELECTION"
  | "CORE_SYSTEM_SELECTION"
  | "ENDING_SELECTION"
  | "SCENARIO_BIBLE"
  | "BIBLE_REVIEW"
  | "CHAPTER_PLOT"
  | "CHAPTER_REVIEW"
  | "BRANCH_GRAPH_DESIGN"
  | "BRANCH_GRAPH_REVIEW"
  | "SCENE_EXPANSION"
  | "FINAL_SAVE";

export interface ScenarioConfirmed {
  genre?: string;
  worldRule?: string;
  protagonist?: string;
  antagonist?: string;
  coreSystem?: string;
  endingDirection?: string;
}

export interface ScenarioState {
  version: "scenario_state_v1";
  stage: ScenarioStage;
  confirmed: ScenarioConfirmed;
  awaitingChoice?: boolean;
  lastOptions?: Record<string, string>;
  scenarioBible?: string;
  chapterPlots: Record<string, string>;
  branchGraph?: unknown;
  sceneDrafts: Record<string, string>;
  currentChapter: number;
  currentNodeId?: string;
  warnings: string[];
  updatedAt: string;
}

export interface ScenarioExport {
  version: "scenario_plan_v1";
  exportedAt: string;
  state: ScenarioState;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}
