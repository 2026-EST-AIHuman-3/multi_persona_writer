import { ScenarioStage, ScenarioState } from "./types";

type SelectionField = keyof ScenarioState["confirmed"];

const STAGE_CONFIG: Partial<Record<ScenarioStage, { field: SelectionField; nextStage: ScenarioStage }>> = {
  DIRECTION_SELECTION: { field: "genre", nextStage: "WORLD_RULE_SELECTION" },
  WORLD_RULE_SELECTION: { field: "worldRule", nextStage: "PROTAGONIST_SELECTION" },
  PROTAGONIST_SELECTION: { field: "protagonist", nextStage: "ANTAGONIST_SELECTION" },
  ANTAGONIST_SELECTION: { field: "antagonist", nextStage: "CORE_SYSTEM_SELECTION" },
  CORE_SYSTEM_SELECTION: { field: "coreSystem", nextStage: "ENDING_SELECTION" },
  ENDING_SELECTION: { field: "endingDirection", nextStage: "SCENARIO_BIBLE" },
};

export function isScenarioSelectionStage(stage: ScenarioStage): boolean {
  return Boolean(STAGE_CONFIG[stage]);
}

export function isScenarioStartInput(input: string): boolean {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (/^[1234]\s*번?/.test(normalized)) return false;
  return /(게임\s*시나리오|게임\s*스토리|게임\s*기획|게임\s*제작)/i.test(normalized);
}

export function handleScenarioSelectionTurn(
  state: ScenarioState,
  userInput: string
): { state: ScenarioState; message: string } {
  const next = cloneState(state);

  if (!next.awaitingChoice) {
    const options = getOptionsForStage(next);
    next.awaitingChoice = true;
    next.lastOptions = options;
    next.updatedAt = new Date().toISOString();

    return {
      state: next,
      message: buildOptionsMessage(next, options),
    };
  }

  const selected = parseSelection(userInput, next.lastOptions || {});
  if (!selected) {
    return {
      state: next,
      message: buildSelectionRetryMessage(next.lastOptions || {}),
    };
  }

  const config = STAGE_CONFIG[next.stage];
  if (!config) {
    return { state: next, message: "현재 단계에서는 선택지를 처리할 수 없어." };
  }

  next.confirmed[config.field] = selected;
  next.stage = config.nextStage;
  next.updatedAt = new Date().toISOString();

  if (next.stage === "SCENARIO_BIBLE") {
    next.awaitingChoice = false;
    next.lastOptions = {};
    return {
      state: next,
      message:
        `선택 결과: ${selected}\n\n` +
        `기획 방향 선택을 모두 확정했어.\n` +
        `다음 입력에서 1차 게임 시나리오 바이블을 작성한다. "다음"이라고 입력해줘.`,
    };
  }

  const options = getOptionsForStage(next);
  next.awaitingChoice = true;
  next.lastOptions = options;

  return {
    state: next,
    message:
      `선택 결과: ${selected}\n\n` +
      `${buildConfirmedSummary(next)}\n\n` +
      `${buildOptionsMessage(next, options, false)}`,
  };
}

function getOptionsForStage(state: ScenarioState): Record<string, string> {
  const genre = state.confirmed.genre || "";
  const worldRule = state.confirmed.worldRule || "";
  const protagonist = state.confirmed.protagonist || "";
  const antagonist = state.confirmed.antagonist || "";
  const coreSystem = state.confirmed.coreSystem || "";

  switch (state.stage) {
    case "DIRECTION_SELECTION":
      return {
        "1": "판타지 액션 RPG - 검, 마법, 보스전, 성장 시스템을 중심으로 직접 전투와 서사를 함께 진행한다.",
        "2": "사이버펑크 추리 어드벤처 - 기업 도시, 기억 조작, 해킹, 단서 수집을 중심으로 진실을 추적한다.",
        "3": "생활 경영 RPG - 하루 단위 선택, 관계 변화, 자원 관리, 작은 성장을 중심으로 장기 목표를 만든다.",
        "4": "직접 입력",
      };
    case "WORLD_RULE_SELECTION":
      if (genre.includes("생활")) {
        return {
          "1": "하루 일정과 체력 규칙 - 매일 선택한 행동이 관계, 수입, 단서 발견률을 바꾼다.",
          "2": "마을 평판과 신뢰 규칙 - 주민과의 대화 결과가 상점, 의뢰, 숨은 정보 접근을 연다.",
          "3": "계절 변화와 자원 순환 규칙 - 계절마다 목표와 위험이 달라지고 장기 계획이 중요해진다.",
          "4": "직접 입력",
        };
      }
      if (genre.includes("사이버") || genre.includes("기억")) {
        return {
          "1": "기억 담보 규칙 - 능력이나 정보를 얻을 때 기존 기억 일부를 대가로 잃는다.",
          "2": "감시 등급 규칙 - 도시의 카메라와 계약 기록이 플레이어의 이동 가능 구역을 바꾼다.",
          "3": "해킹 권한 규칙 - 수집한 단서와 장착한 기억에 따라 대화와 침투 선택지가 열린다.",
          "4": "직접 입력",
        };
      }
      return {
        "1": "계약 유대 규칙 - 정령이나 동료와 신뢰를 쌓아야 새로운 능력과 진화가 열린다.",
        "2": "룬 조합 규칙 - 수집한 룬을 무기와 조합해 속성, 스킬, 탐험 능력을 바꾼다.",
        "3": "균열 위험 규칙 - 위험 지역에 오래 머물수록 보상은 커지지만 적의 압박도 강해진다.",
        "4": "직접 입력",
      };
    case "PROTAGONIST_SELECTION":
      return {
        "1": `${genre || "선택한 장르"}에 처음 들어온 초보자 - 플레이어가 세계 규칙을 함께 배워 가기 좋다.`,
        "2": `${worldRule || "세계관 규칙"} 때문에 중요한 것을 잃은 인물 - 개인 목표와 메인 갈등을 강하게 만든다.`,
        "3": "작은 공동체를 지키려는 실무형 주인공 - 반복 플레이, 관계 변화, 자원 관리와 잘 연결된다.",
        "4": "직접 입력",
      };
    case "ANTAGONIST_SELECTION":
      return {
        "1": `${worldRule || "핵심 규칙"}을 독점해 사람들의 선택을 통제하는 조직 - 시스템과 직접 충돌한다.`,
        "2": `${protagonist || "주인공"}의 약점을 알고 흔드는 라이벌 - 개인 감정선과 반복 갈등을 만든다.`,
        "3": "공동체의 안전을 명분으로 자유를 제한하는 관리자 - 선악이 단순하지 않은 선택을 만든다.",
        "4": "직접 입력",
      };
    case "CORE_SYSTEM_SELECTION":
      return {
        "1": "선택-단서 기록 시스템 - 플레이어의 대화와 탐사 결과가 다음 선택지와 결말 조건을 바꾼다.",
        "2": "관계 수치와 협력 행동 시스템 - 동료 신뢰도에 따라 전투, 탐사, 설득 방식이 달라진다.",
        "3": `${antagonist || "적대 세력"}의 압박을 피해 자원을 배분하는 위험 관리 시스템 - 실패 대신 다른 경로를 연다.`,
        "4": "직접 입력",
      };
    case "ENDING_SELECTION":
      return {
        "1": "관계 수용 엔딩 - 모든 진실을 얻지는 못해도 현재 관계와 선택을 받아들인다.",
        "2": "진실 회복 엔딩 - 큰 대가를 치르더라도 사건의 전체 진실을 공개한다.",
        "3": `${coreSystem || "핵심 시스템"}의 규칙을 바꾸는 개혁 엔딩 - 다음 회차나 후속작 가능성을 남긴다.`,
        "4": "직접 입력",
      };
    default:
      return {};
  }
}

function buildOptionsMessage(
  state: ScenarioState,
  options: Record<string, string>,
  includeSummary = true
): string {
  const lines = Object.entries(options).map(([key, value]) => `${key}번. ${value}`);
  const summary = includeSummary ? `${buildConfirmedSummary(state)}\n\n` : "";

  return (
    `${summary}` +
    `이번 단계 목적: ${getStagePurpose(state.stage)}\n\n` +
    `${lines.join("\n")}\n\n` +
    `추천안: ${getRecommendation(state.stage, options)}`
  );
}

function buildConfirmedSummary(state: ScenarioState): string {
  const confirmed = state.confirmed;
  const items = [
    confirmed.genre && `장르: ${confirmed.genre}`,
    confirmed.worldRule && `세계관 규칙: ${confirmed.worldRule}`,
    confirmed.protagonist && `주인공: ${confirmed.protagonist}`,
    confirmed.antagonist && `적대 세력: ${confirmed.antagonist}`,
    confirmed.coreSystem && `핵심 시스템: ${confirmed.coreSystem}`,
    confirmed.endingDirection && `엔딩 방향: ${confirmed.endingDirection}`,
  ].filter(Boolean);

  return `확정 요약: ${items.length ? items.join("\n") : "아직 없음"}`;
}

function getStagePurpose(stage: ScenarioStage): string {
  switch (stage) {
    case "DIRECTION_SELECTION":
      return "게임의 큰 장르 방향과 기본 플레이 감각을 정한다.";
    case "WORLD_RULE_SELECTION":
      return "확정된 장르에 맞는 세계관 핵심 규칙을 정한다.";
    case "PROTAGONIST_SELECTION":
      return "플레이어가 조종할 주인공의 결핍과 목표를 정한다.";
    case "ANTAGONIST_SELECTION":
      return "주인공을 압박할 적대 세력과 갈등 축을 정한다.";
    case "CORE_SYSTEM_SELECTION":
      return "서사와 플레이를 연결할 핵심 시스템을 정한다.";
    case "ENDING_SELECTION":
      return "마지막 선택과 결말 방향을 정한다.";
    default:
      return "현재 단계의 선택을 정한다.";
  }
}

function getRecommendation(stage: ScenarioStage, options: Record<string, string>): string {
  const recommended = stage === "DIRECTION_SELECTION" ? options["2"] : options["1"];
  return recommended || "1번";
}

function buildSelectionRetryMessage(options: Record<string, string>): string {
  const lines = Object.entries(options).map(([key, value]) => `${key}번. ${value}`);
  return (
    `아직 선택이 확정되지 않았어.\n\n` +
    `${lines.join("\n") || "직전 선택지를 다시 확인해줘."}\n\n` +
    `1번/2번/3번 중 하나를 입력하거나, 직접 입력은 "4번. 원하는 방향" 또는 "직접 입력: 원하는 방향"처럼 적어줘.`
  );
}

function parseSelection(input: string, options: Record<string, string>): string | undefined {
  const normalized = input.trim();
  const direct = normalized.match(/^4\s*번?[.)]?\s*(.+)$/);
  if (direct?.[1]) return direct[1].trim();

  const directLabel = normalized.match(/^직접(?:\s*입력)?\s*[:.)-]?\s*(.+)$/);
  if (directLabel?.[1]) return directLabel[1].trim();

  const numeric = normalized.match(/^([123])\s*번?$/);
  if (numeric?.[1]) return options[numeric[1]];

  return undefined;
}

function cloneState(state: ScenarioState): ScenarioState {
  return JSON.parse(JSON.stringify(state)) as ScenarioState;
}
