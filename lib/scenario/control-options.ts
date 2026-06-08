import { ScenarioState } from "./types";

const REVIEW_STAGES = new Set<ScenarioState["stage"]>([
  "BIBLE_REVIEW",
  "CHAPTER_REVIEW",
  "BRANCH_GRAPH_REVIEW",
  "SCENE_EXPANSION",
]);

export function normalizeScenarioControlChoices(text: string, state: ScenarioState): string {
  if (!REVIEW_STAGES.has(state.stage)) return text;

  const body = text.replace(/\n?(?:\[검수 후 선택\]|검수 후 선택\s*:)[\s\S]*$/u, "").trim();
  const choices = buildControlChoiceBlock(state);

  return `${body}\n\n${choices}`;
}

function buildControlChoiceBlock(state: ScenarioState): string {
  switch (state.stage) {
    case "BIBLE_REVIEW":
      return [
        "[검수 후 선택]",
        "1번: 현재 바이블 확정 후 다음 단계",
        "2번: 제안된 수정안 전체 반영 후 다시 작성",
        "3번: 직접 수정 요청 입력",
      ].join("\n");
    case "CHAPTER_REVIEW":
      return [
        "[검수 후 선택]",
        `1번: 현재 챕터 ${state.currentChapter} 초안 확정 후 다음 단계`,
        "2번: 제안된 수정안 전체 반영 후 다시 작성",
        "3번: 직접 수정 요청 입력",
      ].join("\n");
    case "BRANCH_GRAPH_REVIEW":
      return [
        "[검수 후 선택]",
        "1번: 현재 분기 그래프 확정 후 다음 단계",
        "2번: 제안된 수정안 전체 반영 후 다시 작성",
        "3번: 직접 수정 요청 입력",
      ].join("\n");
    case "SCENE_EXPANSION":
      return [
        "[검수 후 선택]",
        `1번: 현재 노드 ${state.currentNodeId || "현재 장면"} 원고 확정 후 다음 단계`,
        "2번: 제안된 수정안 전체 반영 후 다시 작성",
        "3번: 직접 수정 요청 입력",
      ].join("\n");
    default:
      return "";
  }
}
