import { ScenarioExport, ScenarioState } from "./types";

export function createScenarioExport(
  state: ScenarioState,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): ScenarioExport {
  return {
    version: "scenario_plan_v1",
    exportedAt: new Date().toISOString(),
    state,
    messages,
  };
}

export function downloadScenarioExport(payload: ScenarioExport) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `scenario_plan_${stamp}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
