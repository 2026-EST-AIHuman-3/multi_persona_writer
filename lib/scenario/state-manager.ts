import { ScenarioStage, ScenarioState } from "./types";

const STORAGE_KEY = "persona-writer-scenario-state-v1";

export function createInitialScenarioState(): ScenarioState {
  return {
    version: "scenario_state_v1",
    stage: "DIRECTION_SELECTION",
    confirmed: {},
    awaitingChoice: false,
    lastOptions: {},
    chapterPlots: {},
    sceneDrafts: {},
    currentChapter: 1,
    warnings: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadScenarioState(): ScenarioState {
  if (typeof window === "undefined") return createInitialScenarioState();

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createInitialScenarioState();

  try {
    const parsed = JSON.parse(raw) as ScenarioState;
    if (parsed?.version !== "scenario_state_v1") return createInitialScenarioState();
    return {
      ...createInitialScenarioState(),
      ...parsed,
      confirmed: parsed.confirmed || {},
      awaitingChoice: Boolean(parsed.awaitingChoice),
      lastOptions: parsed.lastOptions || {},
      chapterPlots: parsed.chapterPlots || {},
      sceneDrafts: parsed.sceneDrafts || {},
      warnings: parsed.warnings || [],
    };
  } catch {
    return createInitialScenarioState();
  }
}

export function saveScenarioState(state: ScenarioState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() })
  );
}

export function resetScenarioState(): ScenarioState {
  const state = createInitialScenarioState();
  saveScenarioState(state);
  return state;
}

export function isScenarioSelectionStage(stage: ScenarioStage): boolean {
  return Boolean(getSelectionConfig(stage));
}

export function isValidScenarioSelectionInput(input: string): boolean {
  return Boolean(resolveSelectedOption(input.trim(), {}, true));
}

export function advanceScenarioState(
  state: ScenarioState,
  userInput: string,
  assistantOutput: string
): ScenarioState {
  const normalized = userInput.trim();
  const next = structuredClone(state) as ScenarioState;
  next.updatedAt = new Date().toISOString();

  const selectionResult = advanceSelectionStage(next, normalized, assistantOutput);
  if (selectionResult) {
    return selectionResult;
  }

  if (next.stage === "SCENARIO_BIBLE") {
    next.scenarioBible = assistantOutput;
    next.stage = "BIBLE_REVIEW";
    next.awaitingChoice = false;
    next.lastOptions = {};
  } else if (next.stage === "BIBLE_REVIEW") {
    next.stage = normalized.startsWith("2") ? "SCENARIO_BIBLE" : "CHAPTER_PLOT";
    next.currentChapter = 1;
  } else if (next.stage === "CHAPTER_PLOT") {
    next.chapterPlots[`chapter_${next.currentChapter}`] = assistantOutput;
    next.stage = "CHAPTER_REVIEW";
  } else if (next.stage === "CHAPTER_REVIEW") {
    if (normalized.startsWith("2")) {
      next.stage = "CHAPTER_PLOT";
    } else if (next.currentChapter < 2) {
      next.currentChapter += 1;
      next.stage = "CHAPTER_PLOT";
    } else {
      next.stage = "BRANCH_GRAPH_DESIGN";
    }
  } else if (next.stage === "BRANCH_GRAPH_DESIGN") {
    next.branchGraph = safeJsonOrText(assistantOutput);
    next.stage = "BRANCH_GRAPH_REVIEW";
  } else if (next.stage === "BRANCH_GRAPH_REVIEW") {
    next.stage = normalized.startsWith("2") ? "BRANCH_GRAPH_DESIGN" : "SCENE_EXPANSION";
    next.currentNodeId = "chap01_scene01";
  } else if (next.stage === "SCENE_EXPANSION") {
    const nodeId = next.currentNodeId || `scene_${Object.keys(next.sceneDrafts).length + 1}`;
    next.sceneDrafts[nodeId] = assistantOutput;
    next.currentNodeId = getNextNodeId(nodeId);
    if (!next.currentNodeId) next.stage = "FINAL_SAVE";
  }

  return next;
}

function advanceSelectionStage(
  state: ScenarioState,
  input: string,
  assistantOutput: string
): ScenarioState | undefined {
  const config = getSelectionConfig(state.stage);
  if (!config) return undefined;

  if (!state.awaitingChoice) {
    state.awaitingChoice = true;
    state.lastOptions = extractOptions(assistantOutput);
    return state;
  }

  const selected = resolveSelectedOption(input, state.lastOptions || {});
  if (!selected) {
    state.awaitingChoice = true;
    state.lastOptions = extractOptions(assistantOutput);
    return state;
  }

  state.confirmed[config.field] = selected;
  state.lastOptions = extractOptions(assistantOutput);

  if (state.stage === "ENDING_SELECTION") {
    state.scenarioBible = assistantOutput;
    state.stage = "BIBLE_REVIEW";
    state.awaitingChoice = false;
    state.lastOptions = {};
    return state;
  }

  state.stage = config.nextStage;
  state.awaitingChoice = true;
  return state;
}

function getSelectionConfig(stage: ScenarioStage):
  | { field: keyof ScenarioState["confirmed"]; nextStage: ScenarioStage }
  | undefined {
  switch (stage) {
    case "DIRECTION_SELECTION":
      return { field: "genre", nextStage: "WORLD_RULE_SELECTION" };
    case "WORLD_RULE_SELECTION":
      return { field: "worldRule", nextStage: "PROTAGONIST_SELECTION" };
    case "PROTAGONIST_SELECTION":
      return { field: "protagonist", nextStage: "ANTAGONIST_SELECTION" };
    case "ANTAGONIST_SELECTION":
      return { field: "antagonist", nextStage: "CORE_SYSTEM_SELECTION" };
    case "CORE_SYSTEM_SELECTION":
      return { field: "coreSystem", nextStage: "ENDING_SELECTION" };
    case "ENDING_SELECTION":
      return { field: "endingDirection", nextStage: "SCENARIO_BIBLE" };
    default:
      return undefined;
  }
}

function resolveSelectedOption(
  input: string,
  options: Record<string, string>,
  allowNumericWithoutOptions = false
): string | undefined {
  const direct = input.match(/^4\s*번?[.)]?\s*(.+)$/);
  if (direct?.[1]) return direct[1].trim();

  const directLabel = input.match(/^직접(?:\s*입력)?\s*[:.)-]?\s*(.+)$/);
  if (directLabel?.[1]) return directLabel[1].trim();

  const numeric = input.match(/^([123])\s*번?$/);
  if (numeric?.[1]) {
    return options[numeric[1]] || (allowNumericWithoutOptions ? `${numeric[1]}번 선택지` : undefined);
  }

  return undefined;
}

function isMetaSelectionInput(input: string): boolean {
  const compact = input.replace(/\s+/g, "");
  if (/^(다음|계속|진행|ㄷㅇ)$/i.test(compact)) return true;
  if (/^(장르|세계관|규칙|주인공|적대세력|시스템|엔딩)(부터|먼저)?(하자|정하자|가자)?$/i.test(compact)) {
    return true;
  }
  if (/^(추천|알아서|네가골라|선택지다시)$/i.test(compact)) return true;
  return false;
}

function extractOptions(text: string): Record<string, string> {
  const options: Record<string, string> = {};
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const match = line.match(/^([1-4])\s*번\s*[:.)-]?\s*(.+)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();
    if (value === "직접 입력" || value.includes("직접")) {
      value = "직접 입력";
    }
    options[key] = value;
  }

  return options;
}

function safeJsonOrText(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return text;
    }
  }
  return text;
}

function getNextNodeId(nodeId: string): string | undefined {
  const queue = [
    "chap01_scene01",
    "chap01_choice01",
    "chap01_branch_cooperate",
    "chap01_branch_cautious",
    "chap01_merge01",
    "chap01_to_chap02_bridge",
    "chap02_scene01",
    "chap02_choice01",
    "ending_bond",
    "chap02_scene02",
    "ending_cost",
  ];
  const index = queue.indexOf(nodeId);
  return index >= 0 ? queue[index + 1] : undefined;
}
