import { ScenarioState } from "./types";

const KOREAN_RULES = `
[한국어 출력 규칙]
- 모든 본문은 자연스러운 한국어로 작성한다.
- 고유명사를 제외하고 일본어, 중국어, 의미 없는 로마자 토큰을 섞지 않는다.
- 같은 문장, 같은 무대지시, 같은 대사를 반복하지 않는다.
- 사용자의 직접 입력은 선택지 밖의 제안이어도 반영한다.
- 분기 그래프 설계 단계를 제외하고 JSON만 단독 출력하지 않는다.
- 검수 단계의 [검수 후 선택]은 1번 확정, 2번 수정안 반영 후 재작성, 3번 직접 수정 요청만 사용한다.
- PDF 저장, 파일 저장, 전체 확인 같은 임의 선택지를 만들지 않는다.
- 확정 설정의 긴 문장을 화자명, 캐릭터명, 장소명으로 그대로 복사하지 않는다.
`;

export function buildScenarioSystemPrompt(state: ScenarioState): string {
  return `
너는 게임 시나리오 작가이자 인터랙티브 게임 기획 파트너다.
현재 단계와 확정 설정을 반드시 따른다.
확정되지 않은 설정을 임의로 지어내지 않는다.
1차 바이블 전에는 챕터 플롯이나 장면 원고를 쓰지 않는다.
2차 챕터 플롯과 2.2차 분기 그래프 전에는 3차 장면 확장으로 넘어가지 않는다.
긴 JSON은 설명하지 말고 필요한 경우 JSON 본문만 출력한다.

${KOREAN_RULES}

[CURRENT_STATE]
stage: ${state.stage}
currentChapter: ${state.currentChapter}
currentNodeId: ${state.currentNodeId || ""}
confirmed: ${JSON.stringify(state.confirmed, null, 2)}
hasScenarioBible: ${Boolean(state.scenarioBible)}
chapterPlotKeys: ${Object.keys(state.chapterPlots).join(", ")}
hasBranchGraph: ${Boolean(state.branchGraph)}
sceneDraftKeys: ${Object.keys(state.sceneDrafts).join(", ")}
awaitingChoice: ${Boolean(state.awaitingChoice)}
lastOptions: ${JSON.stringify(state.lastOptions || {}, null, 2)}
`;
}

export function buildScenarioUserPrompt(state: ScenarioState, userInput: string): string {
  return `
${buildStageInstruction(state)}

[사용자 입력]
${userInput}
`;
}

function buildStageInstruction(state: ScenarioState): string {
  if (isSelectionStage(state.stage)) {
    return buildSelectionInstruction(state);
  }

  switch (state.stage) {
    case "SCENARIO_BIBLE":
      return `
[이번 단계]
확정 설정을 바탕으로 1차 게임 시나리오 바이블을 작성한다.
항목: 제목, 장르, 핵심 콘셉트, 로그라인, 주인공, 세계관 규칙, 적대 세력, 핵심 플레이 시스템, 챕터 구성 2개, 엔딩 구조, 유지해야 할 설정.
아직 장면 원고는 쓰지 않는다.`;
    case "BIBLE_REVIEW":
      return `
[이번 단계]
1.5차 설정/모순 검수다.
1차 바이블과 확정 설정의 충돌, 주인공 동기, 적대 세력 압박 방식, 챕터 반복, 엔딩 떡밥 연결을 점검한다.
마지막에 [검수 후 선택]은 "1번: 현재 바이블 확정 후 다음 단계", "2번: 제안된 수정안 전체 반영 후 다시 작성", "3번: 직접 수정 요청 입력"만 제시한다.`;
    case "CHAPTER_PLOT":
      return `
[이번 단계]
2차 챕터별 세부 플롯 작성이다.
현재 챕터 ${state.currentChapter}만 작성한다.
항목: 챕터 제목, 목표, 도입 상황, 주요 사건, 플레이어 행동, NPC 상호작용, 게임플레이 요소, 획득 단서, 클라이맥스, 다음 챕터 연결.`;
    case "CHAPTER_REVIEW":
      return `
[이번 단계]
2.5차 챕터 연결성 검수다.
1차 바이블 충돌, 플레이어 행동 부족, 단서/떡밥 약점, 다음 챕터 연결을 점검한다.
마지막에 [검수 후 선택]은 "1번: 현재 챕터 초안 확정 후 다음 단계", "2번: 제안된 수정안 전체 반영 후 다시 작성", "3번: 직접 수정 요청 입력"만 제시한다.`;
    case "BRANCH_GRAPH_DESIGN":
      return `
[이번 단계]
2.2차 분기 그래프 설계다.
반드시 story_graph_v1 JSON만 출력한다.
필수: version, start_node, flags_schema, nodes, ending_conditions.
단기 분기는 merge 노드로 합류시키고, 핵심 분기만 엔딩 방향을 바꾼다.`;
    case "BRANCH_GRAPH_REVIEW":
      return `
[이번 단계]
분기 그래프 검수다.
반응 분기/단기 분기/핵심 분기 구분, merge 여부, effects 활용, 원고량 폭발 가능성, 챕터 플롯 충돌을 점검한다.
마지막에 [검수 후 선택]은 "1번: 현재 분기 그래프 확정 후 다음 단계", "2번: 제안된 수정안 전체 반영 후 다시 작성", "3번: 직접 수정 요청 입력"만 제시한다.`;
    case "SCENE_EXPANSION":
      return `
[이번 단계]
3차 장면 원고 작성이다.
현재 노드 ${state.currentNodeId} 하나만 작성한다.
반드시 [대사 원고]와 [다음 연결]만 출력한다.
장면 설명 요약이 아니라 실제 초안 원고를 쓴다.
같은 문장을 반복하지 않는다.
화자명은 주인공, 동료, 시스템, 경비병, 안내자처럼 짧게 쓴다.
확정 설정 문장이나 선택지 문장을 대사/화자명으로 그대로 반복하지 않는다.
영어 구절, 일본어, 중국어, 한자, 의미 없는 로마자 토큰을 출력하지 않는다.`;
    case "FINAL_SAVE":
      return `
[이번 단계]
최종 저장 안내다.
네온 누아르 독백 톤으로, 0차 선택부터 3차 장면 확장까지 정리했고 후속 작업용 JSON을 저장할 수 있다고 안내한다.`;
    default:
      return "현재 상태에 맞게 작업을 이어간다.";
  }
}

function isSelectionStage(stage: ScenarioState["stage"]) {
  return [
    "DIRECTION_SELECTION",
    "WORLD_RULE_SELECTION",
    "PROTAGONIST_SELECTION",
    "ANTAGONIST_SELECTION",
    "CORE_SYSTEM_SELECTION",
    "ENDING_SELECTION",
  ].includes(stage);
}

function buildSelectionInstruction(state: ScenarioState): string {
  const item = getSelectionItemName(state.stage);
  const nextItem = getNextSelectionItemName(state.stage);

  if (!state.awaitingChoice) {
    if (state.stage === "DIRECTION_SELECTION") {
      return `
[이번 단계]
사용자가 게임 시나리오 제작을 시작했다.
아직 장르는 확정되지 않았다.
이번 응답의 목적은 장르를 고르는 선택지를 제시하는 것이다.

[출력 규칙]
- "확정 요약: 아직 없음"으로 시작한다.
- "이번 단계 목적: 게임의 큰 장르 방향과 기본 플레이 감각을 정한다."라고 쓴다.
- 1번/2번/3번은 서로 다른 장르 후보로만 제시한다.
- 각 선택지는 "1번. 장르명 - 설명" 형식으로 쓰고, 번호만 나열하지 않는다.
- 사용자가 말하지 않은 "한국형", "야생", "디지몬", 특정 세계관 수식어를 먼저 붙이지 않는다.
- 각 선택지는 장르명 + 플레이 감각 설명으로 구성한다.
- 4번은 직접 입력으로 둔다.
- 추천안은 하나만 제시하되, 추천을 확정처럼 쓰지 않는다.
- 세계관 규칙, 주인공, 적대 세력, 챕터 플롯, JSON은 쓰지 않는다.`;
    }

    return `
[이번 단계]
${item}을 정하기 위한 선택지를 제시한다.
아직 사용자가 선택하지 않았다.

[출력 규칙]
- 확정 요약을 짧게 쓴다.
- 이번 단계 목적을 쓴다.
- 1번/2번/3번은 현재 확정 설정에 맞춰 서로 다른 구체적 선택지로 만든다.
- 각 선택지는 "1번. 선택지명 - 설명" 형식으로 쓰고, 번호만 나열하지 않는다.
- 4번은 직접 입력으로 둔다.
- 추천안을 하나 제시한다.
- 1차 바이블, 챕터 플롯, 장면 원고, JSON은 쓰지 않는다.`;
  }

  if (state.stage === "ENDING_SELECTION") {
    return `
[이번 단계]
사용자가 직전 선택지 중 하나를 골랐다.
lastOptions를 보고 사용자의 숫자 입력이 무엇을 의미하는지 확정한다.
선택을 확정한 뒤, 확정 설정만 바탕으로 1차 게임 시나리오 바이블을 작성한다.

[출력 규칙]
- 선택 확정 요약을 먼저 쓴다.
- 이어서 1차 게임 시나리오 바이블을 쓴다.
- 항목: 제목, 장르, 핵심 콘셉트, 로그라인, 주인공, 세계관 규칙, 적대 세력, 핵심 플레이 시스템, 챕터 구성 2개, 엔딩 구조, 유지해야 할 설정.
- 장면 원고와 긴 JSON은 쓰지 않는다.`;
  }

  return `
[이번 단계]
사용자가 직전 선택지 중 하나를 골랐다.
lastOptions를 보고 사용자의 숫자 입력이 무엇을 의미하는지 확정한다.
확정한 내용을 반영해 다음 단계인 ${nextItem} 선택지를 제시한다.

[출력 규칙]
- 선택 확정 요약을 먼저 쓴다.
- 확정 설정을 임의로 바꾸지 않는다.
- 1번/2번/3번은 방금 확정된 설정과 직접 연결된 새 선택지로 만든다.
- 각 선택지는 "1번. 선택지명 - 설명" 형식으로 쓰고, 번호만 나열하지 않는다.
- 4번은 직접 입력으로 둔다.
- 추천안을 하나 제시한다.
- 1차 바이블, 챕터 플롯, 장면 원고, JSON은 쓰지 않는다.`;
}

function getSelectionItemName(stage: ScenarioState["stage"]) {
  switch (stage) {
    case "DIRECTION_SELECTION":
      return "게임의 큰 장르 방향과 기본 플레이 감각";
    case "WORLD_RULE_SELECTION":
      return "게임 세계를 지배하는 핵심 규칙";
    case "PROTAGONIST_SELECTION":
      return "플레이어가 조종할 주인공의 결핍, 목표, 첫 동기";
    case "ANTAGONIST_SELECTION":
      return "주인공을 압박할 적대 세력과 갈등 축";
    case "CORE_SYSTEM_SELECTION":
      return "서사와 플레이를 연결할 핵심 시스템";
    case "ENDING_SELECTION":
      return "엔딩 질문과 결말 방향";
    default:
      return "현재 항목";
  }
}

function getNextSelectionItemName(stage: ScenarioState["stage"]) {
  switch (stage) {
    case "DIRECTION_SELECTION":
      return "세계관 규칙";
    case "WORLD_RULE_SELECTION":
      return "주인공 설정";
    case "PROTAGONIST_SELECTION":
      return "적대 세력";
    case "ANTAGONIST_SELECTION":
      return "핵심 플레이 시스템";
    case "CORE_SYSTEM_SELECTION":
      return "엔딩 방향";
    default:
      return "다음 항목";
  }
}
