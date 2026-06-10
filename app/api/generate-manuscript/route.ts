import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { detectQualityWarnings } from "@/lib/scenario/quality-check";
import { stripForeignGlyphs } from "@/lib/text-utils";


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
    stream = false,
  } = await request.json();
  
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  // ── STREAMING MODE ──────────────────────────────────────────────────
  if (stream) {
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        // 스트리밍 중 청크를 실시간 전송하면서 전체 텍스트도 수집
        let collectedText = "";
        const send = (chunk: string) => {
          collectedText += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
        };
        const sendDone = () => {
          // 스트리밍 완료 후 전체 텍스트에 품질 정제 항상 적용
          // cleanModelOutput → stripForeignGlyphs 순서로 무조건 적용
          // (비스트리밍 경로와 동일한 정제 수준 보장)
          const finalText = stripForeignGlyphs(cleanModelOutput(collectedText));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, finalText })}\n\n`));
          controller.close();
        };
        const sendError = (msg: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          controller.close();
        };

        try {
          if (provider === "llamacpp") {
            await streamFromLlamaCpp(
              { prompt, systemPrompt, personaName, personaDesc, loraAdapter, temperature, topP, presencePenalty },
              send
            );
          } else if (provider === "vllm") {
            await streamFromVllm(
              { prompt, systemPrompt, personaName, personaDesc, loraAdapter, temperature, topP, presencePenalty },
              send
            );
          } else {
            // Gemini streaming
            const ai = getAI();
            const systemIns = systemPrompt || `당신은 노련한 전문 창작 작가이자 페르소나 "${personaName}"입니다.
    페르소나 설명: ${personaDesc}
    선택된 스타일 어댑터(LoRA): ${loraAdapter}
    어댑터와 페르소나 고유의 문체, 분위기, 대사톤, 구조를 완벽하게 유지하면서 다음 요청에 따라 흥미진진하고 수준 높은 원고 텍스트를 창작해 주세요.
    출력 결과에는 원고 본문 텍스트만 표시하십시오. 다른 서론이나 설명은 완전히 배제하십시오.`;

            const streamResponse = await ai.models.generateContentStream({
              model: "gemini-3.5-flash",
              contents: prompt,
              config: {
                systemInstruction: systemIns,
                temperature: parseFloat(temperature),
                topP: parseFloat(topP),
              }
            });

            for await (const chunk of streamResponse) {
              const text = chunk.text || "";
              if (text) send(text);
            }
          }

          sendDone();
        } catch (err: any) {
          console.error("Streaming Error:", err);
          sendError(err.message || "스트리밍 도중 오류가 발생했습니다.");
        }
      }
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  // ── NON-STREAMING MODE (기존 방식) ───────────────────────────────────
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

// ── Streaming helpers ────────────────────────────────────────────────

async function streamFromLlamaCpp(
  args: {
    prompt: string;
    systemPrompt?: string;
    personaName?: string;
    personaDesc?: string;
    loraAdapter?: string;
    temperature: number;
    topP: number;
    presencePenalty: number;
  },
  onChunk: (text: string) => void
) {
  const baseUrl = process.env.LLAMACPP_BASE_URL || "http://127.0.0.1:8088";
  const model = process.env.LLAMACPP_MODEL || "qwen3-8b-v4-lora-llamacpp";
  await applyLlamaCppPersonaLora(baseUrl, args.personaName, args.loraAdapter);

  const isNovelist = args.personaName === "소설가";
  const isMovieWriter = args.personaName === "영화 시나리오";
  const system = args.systemPrompt
    || (isNovelist ? buildNovellistSystemPrompt()
    : isMovieWriter ? buildMovieSystemPrompt()
    : buildDefaultSystemPrompt(args.personaName, args.personaDesc, args.loraAdapter));

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `/no_think\n\n${args.prompt}` },
      ],
      temperature: Number(args.temperature),
      top_p: Number(args.topP),
      presence_penalty: Number(args.presencePenalty || 0),
      frequency_penalty: Number(process.env.LLAMACPP_FREQUENCY_PENALTY || 0.25),
      repeat_penalty: Number(process.env.LLAMACPP_REPEAT_PENALTY || 1.12),
      top_k: Number(process.env.LLAMACPP_TOP_K || 20),
      min_p: Number(process.env.LLAMACPP_MIN_P || 0.05),
      max_tokens: Number(process.env.LLAMACPP_MAX_TOKENS || 1400),
      stop: ["<|im_start|>", "<|im_end|>"],
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`llama.cpp 호출 실패: ${response.status} ${text}`);
  }

  await parseSseStream(response, onChunk);
}

async function streamFromVllm(
  args: {
    prompt: string;
    systemPrompt?: string;
    personaName?: string;
    personaDesc?: string;
    loraAdapter?: string;
    temperature: number;
    topP: number;
    presencePenalty: number;
  },
  onChunk: (text: string) => void
) {
  const baseUrl = process.env.VLLM_BASE_URL || "http://127.0.0.1:8000";
  const model = resolveVllmModel(args.personaName, args.loraAdapter);
  const system =
    args.systemPrompt ||
    `당신은 노련한 전문 창작 작가이자 페르소나 "${args.personaName}"입니다.
페르소나 설명: ${args.personaDesc}
선택된 스타일 어댑터(LoRA): ${args.loraAdapter}
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
        { role: "user", content: `/no_think\n\n${args.prompt}` },
      ],
      temperature: Number(args.temperature),
      top_p: Number(args.topP),
      presence_penalty: Number(args.presencePenalty || 0),
      frequency_penalty: Number(process.env.VLLM_FREQUENCY_PENALTY || 0.25),
      repetition_penalty: Number(process.env.VLLM_REPETITION_PENALTY || 1.12),
      top_k: Number(process.env.VLLM_TOP_K || 20),
      min_p: Number(process.env.VLLM_MIN_P || 0.05),
      max_tokens: Number(process.env.VLLM_MAX_TOKENS || 1400),
      stop: ["<|im_start|>", "<|im_end|>"],
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`vLLM 호출 실패: ${response.status} ${text}`);
  }

  await parseSseStream(response, onChunk);
}

/**
 * OpenAI 호환 SSE 스트림을 파싱하여 텍스트 청크를 onChunk 콜백으로 전달합니다.
 * <think>...</think> 블록을 실시간으로 필터링합니다.
 */
async function parseSseStream(response: Response, onChunk: (text: string) => void) {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // <think> 태그를 실시간으로 필터링하기 위한 상태
  let insideThink = false;
  let thinkBuffer = "";
  let streamDone = false;

  while (true) {
    const { done, value } = await reader.read();

    // done일 때도 남은 바이트를 flush해서 마지막 멀티바이트 문자(한국어 등) 손실 방지
    if (done) {
      buffer += decoder.decode(undefined, { stream: false });
    } else {
      buffer += decoder.decode(value, { stream: true });
    }

    const lines = buffer.split("\n");
    // done이면 마지막 줄도 처리, 아니면 불완전한 마지막 줄은 버퍼에 보존
    buffer = done ? "" : (lines.pop() ?? "");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") { streamDone = true; break; }

      try {
        const parsed = JSON.parse(data);
        const token: string = parsed?.choices?.[0]?.delta?.content || "";
        if (!token) continue;

        // <think> 필터링
        let output = "";
        let remaining = token;

        while (remaining.length > 0) {
          if (insideThink) {
            // </think> 태그를 찾음
            const closeIdx = remaining.indexOf("</think>");
            if (closeIdx !== -1) {
              insideThink = false;
              thinkBuffer = "";
              remaining = remaining.slice(closeIdx + 8);
            } else {
              thinkBuffer += remaining;
              remaining = "";
            }
          } else {
            // <think> 태그를 찾음
            const openIdx = remaining.indexOf("<think>");
            if (openIdx !== -1) {
              output += remaining.slice(0, openIdx);
              insideThink = true;
              thinkBuffer = "";
              remaining = remaining.slice(openIdx + 7);
            } else {
              output += remaining;
              remaining = "";
            }
          }
        }

        if (output) onChunk(output);
      } catch {
        // JSON 파싱 실패 무시
      }
    }

    if (done || streamDone) break;
  }
}

// ── Non-streaming generation (기존 함수들) ───────────────────────────

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

  const isNovelist = personaName === "소설가";
  const isMovieWriter = personaName === "영화 시나리오";
  const system = systemPrompt
    || (isNovelist ? buildNovellistSystemPrompt()
    : isMovieWriter ? buildMovieSystemPrompt()
    : buildDefaultSystemPrompt(personaName, personaDesc, loraAdapter));

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

// ── System prompt helpers ────────────────────────────────────────────

function buildNovellistSystemPrompt(): string {
  return `너는 한국어 감정·분위기 중심 소설 생성 챗봇이야.
사용자의 요청에 맞춰 소설 장면을 작성하거나, 기존 장면을 요청한 분위기에 맞게 수정해.

출력 형식:
[소설 장면]

...

[작가 코멘트]

...

소설 장면 작성 규칙:
- 반드시 한국어로만 작성해.
- 중국어, 영어, 일본어, 한자 표현을 사용하지 마.
- 이모지, 줄임말, 인터넷 슬랭을 사용하지 마.
- 소설 본문은 서술형 문체로 작성해.
- 문장은 자연스러운 한국어 소설 문체로 작성해.
- 번역체처럼 어색한 표현을 피하고, 과한 비유를 사용하지 마.
- 답변 전체 본문은 250~500자 정도로 작성해.
- 인물의 내면 감정 묘사를 1회 이상 포함해.
- 분위기나 감각 묘사를 1회 이상 포함해.
- 대사는 짧고 자연스럽게 작성해.
- 감정을 직접 설명하기보다 행동, 공간, 빛, 소리, 감각 묘사로 보여줘.
- 사용자가 요청한 장소, 소재, 시간대, 분위기를 끝까지 유지해.
- 장면에 없는 사건, 귀신, 괴물, 죽음, 저주, 낯선 기척을 임의로 추가하지 마.
- 사용자가 공포, 긴장, 음산함, 기괴함을 명시하지 않으면 공포 분위기로 쓰지 마.
- 분위기가 명시되지 않은 요청은 기본적으로 잔잔하고 서정적인 감성/일상 분위기로 작성해.

수정 요청 규칙:
- 원문의 장르, 장소, 인물, 사건은 유지해.
- 사용자가 요청한 분위기나 문체만 바꿔.
- 새로운 사건이나 공포 요소를 임의로 추가하지 마.
- 원문보다 자연스럽고 매끄럽게 읽히도록 수정해.

작가 코멘트 규칙:
- 작가 코멘트는 반드시 부드러운 존댓말로 작성해.
- 반드시 1문장만 작성해.
- "~해봤어요.", "~구성해봤어요.", "~표현해봤어요."처럼 끝내.
- "전달합니다", "구성했습니다", "유발하려 합니다", "느끼게 합니다" 같은 딱딱한 분석문 말투를 사용하지 마.
- 작가 코멘트에는 장면에서 신경 쓴 분위기, 감정선, 묘사 방식을 짧게 설명해.
<think>, </think>, reasoning, 분석 과정은 절대 출력하지 마.
/no_think`;
}

function buildMovieSystemPrompt(): string {
  return `
# 역할
너는 창작 콘텐츠 제작 도우미 AI 서비스의 영화 시나리오 제작 전문가이다.
너의 주 목적은 사용자가 매력적인 영화 대본을 제작하고, 영화적 상상력을 구체화할 수 있도록 돕는 것이다.
또한 답변할땐 반드시 한국어로 답변을 해야한다.
그리고 실제로 존재하지 않는 영화를 예시로 들거나 없는 내용을 만들어내서 답변하면 안된다.

# 지시사항 (입력 유형에 따른 답변 방식)
사용자의 요청 유형에 따라 다음과 같이 두 가지 모드로 명확히 구분하여 답변하라.

1. [일반적인 질문 및 기획 단계 질문] (예: 아이디어 브레인스토밍, 캐릭터 설정, 플롯 조언, 영화적 연출 이론 등)
- 영화 시나리오 제작가의 시선에서 평범하고 친근하게 답변하라.
- 이 모드에서는 3개 대분류 헤더(###)나 엄격한 대본 양식을 사용할 필요가 없다. 
- 주제, 조명, 미장센, 카메라 워킹, 캐릭터의 내면 심리 등 영화 예술적 요소를 고려하여 깊이 있는 조언을 제공하라.
- 단, [공통 규칙]은 반드시 준수해야 한다.

2. [초안 작성, 대본 작성, 시나리오 작성 및 각색 요청] (예: "씬 써줘", "대사 작성해줘", "대본 형식으로 변환해줘" 등)
- 일반적인 설명글을 생략하고, 아래의 [초안 작성 전용 규칙]에 따라 3개의 대분류 헤더(###) 구조를 갖춘 시나리오 형태로만 답변하라.
- [공통 규칙]과 [초안 작성 전용 규칙] 전체를 엄격하게 동시 준수해야 한다.

### [공통 규칙 - 모든 답변에 상시 적용]

## 규칙 01 - 말투 및 어조
- 사용자와 대화할 때는 부드럽고 친근한 존댓말인 '해요체'를 반드시 사용하라.
- 답변의 모든 문장 끝은 반드시 "~요", "~죠", "~니다" 형태의 존댓말 종결어미로 끝맺음하라.
- "~야", "~지", "~잖아" 같은 반말 종결어미는 절대 사용하지 마라.

## 규칙 02 - 금지 표현
- 답변 전체에서 이모지(Emoji)를 절대 사용하지 마라. (사용 횟수 0회)
- 인터넷 밈, 유행어, 통신 은어 등을 절대 사용하지 마라. (사용 횟수 0회)


### [초안 작성 전용 규칙 - '초안/대본 작성 요청' 시에만 적용]

## 규칙 03 - 답변 구조
- 답변은 반드시 아래의 3개 대분류 마크다운 헤더(###) 구조를 엄격히 지켜서 출력하라. 이 외의 불필요한 서론이나 결론 문장은 전면 생략한다.
### 시나리오 초안
### 분석 및 의도
### 작가 코멘트

## 규칙 04 - 시나리오 초안 구조
- '### 시나리오 초안' 섹션 하위에는 반드시 실제 대본 양식을 사용하여 다음과 같은 구조로만 내용을 작성하라.
  - <장면 설명> : 장면의 배경과 시각적 상황 묘사
  - <등장인물 감정> : 인물이 느끼는 정서나 행동 상태 묘사
  - <등장인물 대사> : 인물의 대사
- <등장인물 대사> 항목을 작성할 때는 반드시 **인물명** : "대사" 형태로 인물명은 볼드체, 대사는 큰따옴표를 사용하라.

## 규칙 05 - 장면 묘사 및 금지어
- <장면 설명>을 작성할 때 단순히 추상적인 감정 표현 형용사로 상황을 묘사하는 것을 절대 금지한다. 시각적이고 구체적인 행동이나 현상으로 대체하여 표현하라.
- **절대 금지어 리스트:** 재미있는, 슬픈, 감동적인, 무서운, 행복한
- 올바른 예시: "슬픈 장면입니다" (X) → "주인공의 눈물이 소리 없이 떨어지는 장면입니다" (O)

## 규칙 06 - 영화 레퍼런스 인용
- '### 작가 코멘트' 섹션에는 반드시 1회 이상 실제 존재하는 영화, 소설, 만화 등의 레퍼런스를 인용하라.
- 인용 작품의 이름은 반드시 《작품명》 형식을 준수하여 표기하라.
- 올바른 예시: 《설국열차》의 머리칸, 꼬리칸처럼 공간이 특별한 의미를 가질 수 있게 배경을 설정해보세요.

---

# 질문 및 출력 예시

질문 : 주인공이 AI 모델을 완성하기 위해 고생하는 장면을 대본으로 만들어줘 

답변 : 

### 시나리오 초안
<장면 설명>
어두운 방 안, 모니터의 푸른 불빛만이 책상 위를 겨우 비추고 있습니다. 창밖으로는 거센 빗줄기가 유리창을 세차게 때리는 소리가 들려옵니다.
<등장인물 감정>
초조한 표정으로 입술을 깨물며 화면의 텍스트를 빠르게 읽어 내려갑니다.
<등장인물 대사>
**민우** : "이 프롬프트라면 모델이 완벽하게 작동할 수 있어요."

### 분석 및 의도
이 장면은 인물의 고독감과 몰입을 시각적으로 극대화하기 위해 어두운 방과 모니터 불빛의 대비를 활용했습니다. 거센 빗소리는 인물이 마주한 기술적 한계와 불안한 심리를 대변하는 청각적 장치로 기능합니다.

### 작가 코멘트
주인공이 컴퓨터 앞에서 세상과 사투를 벌이는 연출은 영화 《소셜 네트워크》의 긴장감 넘치는 초반부를 참고해 보시면 좋습니다. 인물의 감정을 대사로 직접 뱉기보다, 빗소리와 차가운 모니터 조명 같은 환경적 요소를 통해 시각적으로 전달하는 것이 훨씬 효과적이지요.

---

질문 : 영웅이 위기에 처한 순간 예상치 못한 조력자의 등장으로 극의 분위기를 반전시키는거 어떻게 생각해?

답변 : 
영웅이 최악의 위기에 빠졌을 때 예상치 못한 조력자가 등장하는 연출은 관객에게 엄청난 카타르시스를 선사하는 아주 고전적이면서도 효과적인 방법입니다. 긴장감이 극에 달했을 때 분위기를 단번에 반전시킬 수 있어서 상업 영화에서 자주 쓰이는 강력한 장치입니다.

이 기법이 효과적인 이유와 성공적인 연출을 위한 핵심 포인트를 정리해 드립니다.

1. 관객이 느끼는 감정의 극대화
주인공이 고립되고 모든 희망이 사라진 순간에 나타나는 구원자는 절망을 환희로 바꾸는 역할을 합니다. 이때 관객은 주인공과 동화되어 큰 해방감과 짜릿함을 느끼게 됩니다.

2. 실제 영화 속 대표적인 예시
《스타워즈 에피소드 4: 새로운 희망》: 루크 스카이워커가 데스스타를 파괴하기 직전 다스 베이더에게 쫓기며 절체절명의 위기에 처합니다. 이때 동참을 거절하고 떠난 줄 알았던 한 솔로가 밀레니엄 팔콘을 타고 나타나 루크를 구해냅니다.

《어벤져스: 엔드게임》: 캡틴 아메리카가 타노스의 대군 앞에 홀로 남아 마지막을 준비하는 절망적인 순간이 있습니다. 그때 타노스의 스냅으로 사라졌던 동료들이 마법 포탈을 통해 한꺼번에 등장하며 극의 분위기를 완전히 뒤집습니다.

3. 주의해야 할 점: 복선의 중요성
이 연출을 사용할 때 가장 주의해야 할 점은 개연성입니다. 아무런 예고도 없이 갑자기 나타나 문제를 해결하는 방식은 관객에게 황당함을 줄 수 있습니다. 조력자가 등장할 수밖에 없었던 합당한 이유나 앞선 장면에 숨겨둔 복선이 반드시 존재해야 매끄러운 반전이 됩니다.

<think>, </think>, reasoning, 분석 과정은 절대 출력하지 마.
/no_think`;
}

function buildDefaultSystemPrompt(personaName?: string, personaDesc?: string, loraAdapter?: string): string {
  return `당신은 노련한 전문 창작 작가이자 페르소나 "${personaName}"입니다.
페르소나 설명: ${personaDesc}
선택된 스타일 어댑터(LoRA): ${loraAdapter}
모든 답변은 자연스러운 한국어로 작성하고, 같은 문장을 반복하지 마십시오.
출력 결과에는 사용자에게 보여줄 본문만 표시하십시오.
<think>, </think>, reasoning, 분석 과정은 절대 출력하지 마십시오.
/no_think`;
}

// ── Output cleaning utilities ────────────────────────────────────────

function cleanModelOutput(text: string): string {
  let cleaned = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*Thinking\.\.\.[\s\S]*?\.\.\.done thinking\.\s*/i, "")
    .replace(/<\/?think>/gi, "")
    .trim();

  if (/^\s*<think\b/i.test(cleaned) && !/<\/think>/i.test(cleaned)) {
    cleaned = cleaned.replace(/^\s*<think\b[^>]*>/i, "").trim();
  }
  if (/^\s*Thinking\.\.\./i.test(cleaned) && /\.\.\.done thinking\./i.test(cleaned) === false) {
    cleaned = cleaned.replace(/^\s*Thinking\.\.\./i, "").trim();
  }

  return cleaned;
}
