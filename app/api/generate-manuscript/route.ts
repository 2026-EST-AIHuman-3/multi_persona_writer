import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { detectQualityWarnings } from "@/lib/scenario/quality-check";

// Initialize Gemini API Client lazily
let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("Warning: GEMINI_API_KEY is not configured or using default placeholder. Gemini calls will fail.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// POST /api/generate-manuscript
export async function POST(request: Request) {
  const {
    prompt,
    systemPrompt,
    personaName,
    personaDesc,
    loraAdapter,
    temperature = 0.5,
    topP = 0.8,
    presencePenalty = 0.65,
    provider = process.env.MODEL_PROVIDER || "llamacpp",
  } = await request.json();
  
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  try {
    if (provider === "llamacpp") {
      const content = await generateWithLlamaCppWithRepair({
        prompt,
        systemPrompt,
        personaName,
        personaDesc,
        loraAdapter,
        temperature,
        topP,
        presencePenalty,
      });
      return NextResponse.json({ content });
    }

    if (provider === "vllm") {
      const content = await generateWithVllmWithRepair({
        prompt,
        systemPrompt,
        personaName,
        personaDesc,
        loraAdapter,
        temperature,
        topP,
        presencePenalty,
      });
      return NextResponse.json({ content });
    }

    const ai = getAI();
    const systemIns = systemPrompt || `당신은 노련한 전문 창작 작가이자 페르소나 "${personaName}"입니다.
    페르소나 설명: ${personaDesc}
    선택된 스타일 어댑터(LoRA): ${loraAdapter}
    어댑터와 페르소나 고유의 문체, 분위기, 대사톤, 구조를 완벽하게 유지하면서 다음 요청에 따라 흥미진진하고 수준 높은 원고 텍스트를 창작해 주세요.
    출력 결과에는 원고 본문 텍스트만 표시하십시오. 다른 서론이나 설명은 완전히 배제하십시오.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemIns,
        temperature: parseFloat(temperature),
        topP: parseFloat(topP),
      }
    });

    const text = response.text || "";
    return NextResponse.json({ content: cleanModelOutput(text) });
  } catch (error: any) {
    console.error("Generation Error:", error);
    return NextResponse.json(
      { error: error.message || "원고 생성 도중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

async function generateWithLlamaCppWithRepair(args: {
  prompt: string;
  systemPrompt?: string;
  personaName?: string;
  personaDesc?: string;
  loraAdapter?: string;
  temperature: number;
  topP: number;
  presencePenalty: number;
}) {
  const first = cleanModelOutput(await generateWithLlamaCpp(args));
  const warnings = detectQualityWarnings(first);
  if (warnings.length === 0) return appendLlamaCppLoraDebug(first);

  const repaired = cleanModelOutput(
    await generateWithLlamaCpp({
      ...args,
      temperature: Math.min(Number(args.temperature) || 0.7, 0.35),
      topP: Math.min(Number(args.topP) || 0.9, 0.75),
      presencePenalty: Math.max(Number(args.presencePenalty) || 0, 0.7),
      prompt:
        `[재작성 요청]\n` +
        `아래 원고에는 품질 문제가 있다: ${warnings.join(", ")}\n` +
        `의미는 유지하되 자연스러운 한국어로 다시 작성하라.\n` +
        `일본어, 중국어, 한자, 키릴 문자, 영어 구절, 베트남어/로마자 혼입 토큰을 모두 제거하라.\n` +
        `같은 문장 반복을 제거하라.\n` +
        `긴 설정 문장을 인물명으로 쓰지 말고 화자명은 주인공, 동료, 시스템, NPC처럼 짧게 고쳐라.\n` +
        `설명 없이 수정된 본문만 출력하라.\n\n` +
        `[원고]\n${first}`,
      systemPrompt:
        `${args.systemPrompt || ""}\n\n` +
        `[강제 품질 규칙]\n` +
        `출력에는 한글, 숫자, 기본 문장부호, 필요한 영문 고유명사만 사용할 수 있다.\n` +
        `키릴 문자 예: сохран, русский 같은 토큰은 절대 출력하지 않는다.\n` +
        `일본어/중국어/한자/베트남어 로마자 혼입 토큰도 절대 출력하지 않는다.\n` +
        `/no_think`,
    })
  );

  const repairedWarnings = detectQualityWarnings(repaired);
  if (repairedWarnings.length === 0) return appendLlamaCppLoraDebug(repaired);

  return appendLlamaCppLoraDebug(stripForeignGlyphs(repaired));
}

async function generateWithVllmWithRepair(args: {
  prompt: string;
  systemPrompt?: string;
  personaName?: string;
  personaDesc?: string;
  loraAdapter?: string;
  temperature: number;
  topP: number;
  presencePenalty: number;
}) {
  const first = cleanModelOutput(await generateWithVllm(args));
  const warnings = detectQualityWarnings(first);
  if (warnings.length === 0) return first;

  const repaired = cleanModelOutput(
    await generateWithVllm({
      ...args,
      temperature: Math.min(Number(args.temperature) || 0.5, 0.35),
      topP: Math.min(Number(args.topP) || 0.8, 0.75),
      presencePenalty: Math.max(Number(args.presencePenalty) || 0, 0.7),
      prompt:
        `[재작성 요청]\n` +
        `아래 원고에는 품질 문제가 있다: ${warnings.join(", ")}\n` +
        `의미는 유지하되 자연스러운 한국어로 다시 작성하라.\n` +
        `일본어, 중국어, 한자, 키릴 문자, 영어 구절, 베트남어/로마자 혼입 토큰을 모두 제거하라.\n` +
        `같은 문장 반복을 제거하라.\n` +
        `긴 설정 문장을 인물명으로 쓰지 말고 화자명은 주인공, 동료, 시스템, NPC처럼 짧게 고쳐라.\n` +
        `설명 없이 수정된 본문만 출력하라.\n\n` +
        `[원고]\n${first}`,
      systemPrompt:
        `${args.systemPrompt || ""}\n\n` +
        `[강제 품질 규칙]\n` +
        `출력에는 한글, 숫자, 기본 문장부호, 필요한 영문 고유명사만 사용할 수 있다.\n` +
        `키릴 문자 예: сохран, русский 같은 토큰은 절대 출력하지 않는다.\n` +
        `일본어/중국어/한자/베트남어 로마자 혼입 토큰도 절대 출력하지 않는다.\n` +
        `/no_think`,
    })
  );

  const repairedWarnings = detectQualityWarnings(repaired);
  if (repairedWarnings.length === 0) return repaired;

  return stripForeignGlyphs(repaired);
}

async function generateWithLlamaCpp({
  prompt,
  systemPrompt,
  personaName,
  personaDesc,
  loraAdapter,
  temperature,
  topP,
  presencePenalty,
}: {
  prompt: string;
  systemPrompt?: string;
  personaName?: string;
  personaDesc?: string;
  loraAdapter?: string;
  temperature: number;
  topP: number;
  presencePenalty: number;
}) {
  const baseUrl = process.env.LLAMACPP_BASE_URL || "http://127.0.0.1:8088";
  const model = process.env.LLAMACPP_MODEL || "qwen3-8b-v4-lora-llamacpp";
  await applyLlamaCppPersonaLora(baseUrl, personaName, loraAdapter);
  const system =
    systemPrompt ||
    `당신은 노련한 전문 창작 작가이자 페르소나 "${personaName}"입니다.
페르소나 설명: ${personaDesc}
선택된 스타일 어댑터(LoRA): ${loraAdapter}
모든 답변은 자연스러운 한국어로 작성하고, 같은 문장을 반복하지 마십시오.
출력 결과에는 사용자에게 보여줄 본문만 표시하십시오.
<think>, </think>, reasoning, 분석 과정은 절대 출력하지 마십시오.
/no_think`;

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `/no_think\n\n${prompt}` },
      ],
      temperature: Number(temperature),
      top_p: Number(topP),
      presence_penalty: Number(presencePenalty || 0),
      frequency_penalty: Number(process.env.LLAMACPP_FREQUENCY_PENALTY || 0.25),
      repeat_penalty: Number(process.env.LLAMACPP_REPEAT_PENALTY || 1.12),
      top_k: Number(process.env.LLAMACPP_TOP_K || 20),
      min_p: Number(process.env.LLAMACPP_MIN_P || 0.05),
      max_tokens: Number(process.env.LLAMACPP_MAX_TOKENS || 1400),
      stop: ["<|im_start|>", "<|im_end|>"],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`llama.cpp 호출 실패: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
}

type LlamaCppLoraAdapter = {
  id: number;
  path?: string;
  scale?: number;
  task_name?: string;
  prompt_prefix?: string;
};

async function applyLlamaCppPersonaLora(baseUrl: string, personaName?: string, loraAdapter?: string) {
  if (process.env.LLAMACPP_LORA_RUNTIME_SWITCH === "false") return;

  const adapters = await getLlamaCppLoraAdapters(baseUrl);
  if (adapters.length === 0) return;

  const targetId = resolveLlamaCppLoraId(adapters, personaName, loraAdapter);
  if (targetId === null) return;

  const scale = Number(process.env.LLAMACPP_LORA_SCALE || 1);
  const body = adapters.map((adapter) => ({
    id: adapter.id,
    scale: adapter.id === targetId ? scale : 0,
  }));

  const response = await fetch(`${baseUrl}/lora-adapters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`llama.cpp LoRA 전환 실패: ${response.status} ${text}`);
  }
}

async function getLlamaCppLoraAdapters(baseUrl: string): Promise<LlamaCppLoraAdapter[]> {
  const response = await fetch(`${baseUrl}/lora-adapters`, { method: "GET" });
  if (!response.ok) return [];

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data
    .map((adapter) => ({
      id: Number(adapter.id),
      path: typeof adapter.path === "string" ? adapter.path : "",
      scale: Number(adapter.scale || 0),
      task_name: typeof adapter.task_name === "string" ? adapter.task_name : "",
      prompt_prefix: typeof adapter.prompt_prefix === "string" ? adapter.prompt_prefix : "",
    }))
    .filter((adapter) => Number.isInteger(adapter.id));
}

async function appendLlamaCppLoraDebug(text: string): Promise<string> {
  if (process.env.LLAMACPP_LORA_DEBUG !== "true") return text;

  const baseUrl = process.env.LLAMACPP_BASE_URL || "http://127.0.0.1:8088";
  const adapters = await getLlamaCppLoraAdapters(baseUrl);
  const active = adapters.filter((adapter) => Number(adapter.scale || 0) > 0);
  const summary =
    active.length > 0
      ? active.map((adapter) => `id=${adapter.id}, scale=${adapter.scale}, path=${adapter.path}`).join(" | ")
      : "none";

  return `[LLAMACPP_LORA_DEBUG] ${summary}\n\n${text}`;
}

function resolveLlamaCppLoraId(
  adapters: LlamaCppLoraAdapter[],
  personaName?: string,
  loraAdapter?: string
): number | null {
  const label = `${personaName || ""} ${loraAdapter || ""}`.toLowerCase();
  const envId = getEnvLoraId(label);
  if (envId !== null && adapters.some((adapter) => adapter.id === envId)) {
    return envId;
  }

  const keywordId = findAdapterIdByKeyword(adapters, label);
  if (keywordId !== null) return keywordId;

  const defaultId = Number(process.env.LLAMACPP_LORA_DEFAULT_ID);
  if (Number.isInteger(defaultId) && adapters.some((adapter) => adapter.id === defaultId)) {
    return defaultId;
  }

  return adapters[0]?.id ?? null;
}

function getEnvLoraId(label: string): number | null {
  const explicitCandidates: Array<[boolean, string | undefined]> = [
    [/\b50\b|checkpoint[_ -]?50|ckpt[_ -]?50/.test(label), process.env.LLAMACPP_LORA_50_ID],
    [/\b500\b|final|500개/.test(label), process.env.LLAMACPP_LORA_500_ID],
  ];

  for (const [matches, value] of explicitCandidates) {
    const id = Number(value);
    if (matches && Number.isInteger(id)) return id;
  }

  const candidates: Array<[boolean, string | undefined]> = [
    [label.includes("game") || label.includes("rpg") || label.includes("게임"), process.env.LLAMACPP_LORA_GAME_ID],
    [label.includes("movie") || label.includes("noir") || label.includes("영화"), process.env.LLAMACPP_LORA_MOVIE_ID],
    [label.includes("novel") || label.includes("literary") || label.includes("소설"), process.env.LLAMACPP_LORA_NOVEL_ID],
    [label.includes("ad") || label.includes("brand") || label.includes("광고"), process.env.LLAMACPP_LORA_AD_ID],
  ];

  for (const [matches, value] of candidates) {
    const id = Number(value);
    if (matches && Number.isInteger(id)) return id;
  }

  return null;
}

function findAdapterIdByKeyword(adapters: LlamaCppLoraAdapter[], label: string): number | null {
  const keywords = [
    label.includes("game") || label.includes("rpg") || label.includes("게임") ? "game" : "",
    label.includes("movie") || label.includes("noir") || label.includes("영화") ? "movie" : "",
    label.includes("novel") || label.includes("literary") || label.includes("소설") ? "novel" : "",
    label.includes("ad") || label.includes("brand") || label.includes("광고") ? "ad" : "",
  ].filter(Boolean);

  for (const keyword of keywords) {
    const adapter = adapters.find((item) => {
      const source = `${item.path || ""} ${item.task_name || ""}`.toLowerCase();
      return source.includes(keyword);
    });
    if (adapter) return adapter.id;
  }

  return null;
}

async function generateWithVllm({
  prompt,
  systemPrompt,
  personaName,
  personaDesc,
  loraAdapter,
  temperature,
  topP,
  presencePenalty,
}: {
  prompt: string;
  systemPrompt?: string;
  personaName?: string;
  personaDesc?: string;
  loraAdapter?: string;
  temperature: number;
  topP: number;
  presencePenalty: number;
}) {
  const baseUrl = process.env.VLLM_BASE_URL || "http://127.0.0.1:8000";
  const model = resolveVllmModel(personaName, loraAdapter);
  const system =
    systemPrompt ||
    `당신은 노련한 전문 창작 작가이자 페르소나 "${personaName}"입니다.
페르소나 설명: ${personaDesc}
선택된 스타일 어댑터(LoRA): ${loraAdapter}
모든 답변은 자연스러운 한국어로 작성하고, 같은 문장을 반복하지 마십시오.
출력 결과에는 사용자에게 보여줄 본문만 표시하십시오.
<think>, </think>, reasoning, 분석 과정은 절대 출력하지 마십시오.
/no_think`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.VLLM_API_KEY) {
    headers.Authorization = `Bearer ${process.env.VLLM_API_KEY}`;
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `/no_think\n\n${prompt}` },
      ],
      temperature: Number(temperature),
      top_p: Number(topP),
      presence_penalty: Number(presencePenalty || 0),
      frequency_penalty: Number(process.env.VLLM_FREQUENCY_PENALTY || 0.25),
      repetition_penalty: Number(process.env.VLLM_REPETITION_PENALTY || 1.12),
      top_k: Number(process.env.VLLM_TOP_K || 20),
      min_p: Number(process.env.VLLM_MIN_P || 0.05),
      max_tokens: Number(process.env.VLLM_MAX_TOKENS || 1400),
      stop: ["<|im_start|>", "<|im_end|>"],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`vLLM 호출 실패: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
}

function resolveVllmModel(personaName?: string, loraAdapter?: string): string {
  const label = `${personaName || ""} ${loraAdapter || ""}`.toLowerCase();
  if ((label.includes("game") || label.includes("rpg") || label.includes("게임")) && process.env.VLLM_MODEL_GAME) {
    return process.env.VLLM_MODEL_GAME;
  }
  if ((label.includes("movie") || label.includes("noir") || label.includes("영화")) && process.env.VLLM_MODEL_MOVIE) {
    return process.env.VLLM_MODEL_MOVIE;
  }
  if ((label.includes("novel") || label.includes("literary") || label.includes("소설")) && process.env.VLLM_MODEL_NOVEL) {
    return process.env.VLLM_MODEL_NOVEL;
  }
  if ((label.includes("ad") || label.includes("brand") || label.includes("광고")) && process.env.VLLM_MODEL_AD) {
    return process.env.VLLM_MODEL_AD;
  }
  return process.env.VLLM_MODEL || "qwen3-8b-game-lora";
}

function cleanModelOutput(text: string): string {
  let cleaned = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*Thinking\.\.\.[\s\S]*?\.\.\.done thinking\.\s*/i, "")
    .replace(/<\/?think>/gi, "")
    .trim();

  if (/^\s*<think\b/i.test(cleaned) && !/<\/think>/i.test(cleaned)) {
    cleaned = cleaned.replace(/^\s*<think\b[^>]*>/i, "").trim();
  }
  if (/^\s*Thinking\.\.\./i.test(cleaned) && !/\.\.\.done thinking\./i.test(cleaned)) {
    cleaned = cleaned.replace(/^\s*Thinking\.\.\./i, "").trim();
  }

  return cleaned;
}

function stripForeignGlyphs(text: string): string {
  return text
    .replace(/[А-Яа-яЁё]+/g, "")
    .replace(/[ぁ-ゟ゠-ヿ]+/g, "")
    .replace(/[一-龯]+/g, "")
    .replace(/[Đđ]+/g, "")
    .replace(/[A-Za-z]{3,}(?:\s+[A-Za-z]{2,}){2,}/g, "")
    .replace(/\b(?!UI\b|NPC\b|RPG\b|JSON\b|PDF\b|LoRA\b|Qwen\b|GGUF\b|ID\b|API\b)[A-Za-z]{2,}\b/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?;:)\]}])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
