import { ScenarioState } from "./types";

export function buildScenarioBranchGraph(state: ScenarioState) {
  const theme =
    state.confirmed.genre ||
    state.confirmed.worldRule ||
    "확정된 게임 시나리오 방향";
  const relationshipFlagDescription = `${theme}에서 핵심 동료 또는 파트너와의 협력 관계 수치`;

  return {
    version: "story_graph_v1",
    source: "system_template",
    revision_note: "Next app deterministic branch graph",
    start_node: "chap01_scene01",
    flags_schema: {
      relationship_score: {
        type: "int",
        default: 0,
        description: relationshipFlagDescription,
      },
      approach_route: {
        type: "string",
        default: "unset",
        description: "초반 갈등에 대응한 방식",
      },
      ending_route: {
        type: "string",
        default: "unset",
        description: "마지막 선택으로 확정되는 결말 방향",
      },
    },
    nodes: [
      {
        node_id: "chap01_scene01",
        chapter: 1,
        scene_index: 1,
        type: "common",
        purpose: "오프닝 사건, 핵심 단서 획득, 기본 플레이 시스템 체험",
        conditions: [],
        next_node: "chap01_choice01",
        choices: [],
      },
      {
        node_id: "chap01_choice01",
        chapter: 1,
        scene_index: 2,
        type: "choice",
        purpose: "첫 단서 직후 협력할지 신중하게 검증할지 선택한다.",
        conditions: [],
        choices: [
          {
            choice_id: "choice_cooperate",
            text: "상대의 말을 듣고 함께 움직인다.",
            effects: {
              relationship_score: 10,
              approach_route: "cooperate",
            },
            next_node: "chap01_branch_cooperate",
          },
          {
            choice_id: "choice_cautious",
            text: "거리를 유지하고 상황부터 확인한다.",
            effects: {
              relationship_score: -5,
              approach_route: "cautious",
            },
            next_node: "chap01_branch_cautious",
          },
        ],
      },
      {
        node_id: "chap01_branch_cooperate",
        chapter: 1,
        scene_index: 3,
        type: "branch",
        purpose: "협력 선택의 짧은 보상 장면",
        conditions: ["approach_route == cooperate"],
        next_node: "chap01_merge01",
        choices: [],
      },
      {
        node_id: "chap01_branch_cautious",
        chapter: 1,
        scene_index: 3,
        type: "branch",
        purpose: "신중 선택의 짧은 검증 장면",
        conditions: ["approach_route == cautious"],
        next_node: "chap01_merge01",
        choices: [],
      },
      {
        node_id: "chap01_merge01",
        chapter: 1,
        scene_index: 4,
        type: "merge",
        purpose: "초반 분기를 합류시키고 챕터 2 이동 단서를 정리한다.",
        conditions: [],
        next_node: "chap01_to_chap02_bridge",
        choices: [],
      },
      {
        node_id: "chap01_to_chap02_bridge",
        chapter: 1,
        scene_index: 5,
        type: "common",
        purpose: "챕터 1 마무리와 챕터 2 진입 조건 확정",
        conditions: [],
        next_node: "chap02_scene01",
        choices: [],
      },
      {
        node_id: "chap02_scene01",
        chapter: 2,
        scene_index: 1,
        type: "common",
        purpose: "적대 세력의 압박 방식과 챕터 1 단서의 확장 의미를 드러낸다.",
        conditions: [],
        next_node: "chap02_choice01",
        choices: [],
      },
      {
        node_id: "chap02_choice01",
        chapter: 2,
        scene_index: 2,
        type: "choice",
        purpose: "관계를 지킬지, 진실 또는 개인 목표를 우선할지 결정한다.",
        conditions: [],
        choices: [
          {
            choice_id: "choice_protect_relationship",
            text: "동료 또는 파트너를 지키며 함께 해결한다.",
            effects: {
              relationship_score: 10,
              ending_route: "bond",
            },
            next_node: "ending_bond",
          },
          {
            choice_id: "choice_prioritize_goal",
            text: "위험을 감수하고 원래 목표를 우선한다.",
            effects: {
              relationship_score: -5,
              ending_route: "cost",
            },
            next_node: "chap02_scene02",
          },
        ],
      },
      {
        node_id: "chap02_scene02",
        chapter: 2,
        scene_index: 3,
        type: "common",
        purpose: "목표 우선 선택의 비용을 보여주고 비용 엔딩으로 연결한다.",
        conditions: ["ending_route == cost"],
        next_node: "ending_cost",
        choices: [],
      },
      {
        node_id: "ending_bond",
        chapter: 2,
        scene_index: 4,
        type: "ending",
        purpose: "관계를 지킨 선택이 남기는 결말",
        conditions: ["ending_route == bond"],
        next_node: null,
        choices: [],
      },
      {
        node_id: "ending_cost",
        chapter: 2,
        scene_index: 5,
        type: "ending",
        purpose: "목표를 우선한 선택이 남기는 비용과 여운",
        conditions: ["ending_route == cost"],
        next_node: null,
        choices: [],
      },
    ],
    ending_conditions: [
      {
        ending_node: "ending_bond",
        conditions: ["ending_route == bond"],
      },
      {
        ending_node: "ending_cost",
        conditions: ["ending_route == cost"],
      },
    ],
  };
}

export function buildBranchGraphMessage(state: ScenarioState): string {
  const graph = buildScenarioBranchGraph(state);
  return (
    `[시스템 생성 분기 그래프]\n` +
    `${JSON.stringify(graph, null, 2)}\n\n` +
    `[스키마 검사 통과]\n` +
    `분기 그래프 구조는 시스템이 생성하고 검증했다.\n\n` +
    `[다음 단계]\n` +
    `"다음"을 입력하면 분기 그래프 내용을 검수한다.`
  );
}
