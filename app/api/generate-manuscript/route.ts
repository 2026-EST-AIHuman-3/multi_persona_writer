import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

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
  const { prompt, personaName, personaDesc, loraAdapter, temperature = 0.7, topP = 0.9, presencePenalty = 0.4 } = await request.json();
  
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  try {
    const ai = getAI();
    const systemIns = `당신은 노련한 전문 창작 작가이자 페르소나 "${personaName}"입니다.
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
    return NextResponse.json({ content: text.trim() });
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    return NextResponse.json(
      { error: error.message || "원고 생성 도중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
