/**
 * 모델 출력물에서 <think> 블록, Thinking... 패턴 등을 제거합니다.
 * 서버(route.ts)와 클라이언트(page.tsx) 양쪽에서 사용 가능한 공유 유틸리티입니다.
 */
export function cleanModelOutput(text: string): string {
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

/**
 * 외국어 글리프(키릴, 한자, 일본어 등)를 제거합니다.
 * 모델이 가끔 비한국어 토큰을 섞어 출력할 때 사용합니다.
 */
export function stripForeignGlyphs(text: string): string {
  return text
    .replace(/[А-Яа-яЁё]+/g, "")
    .replace(/[ぁ-ゟ゠-ヿ]+/g, "")
    .replace(/[一-龯]+/g, "")
    .replace(/[Đđ]+/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?;:)\]}])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 키릴 문자, 일본어, 한자 등 비한국어 글리프가 섞였는지 감지합니다.
 */
export function hasForeignGlyphs(text: string): boolean {
  return (
    /[А-Яа-яЁё]/.test(text) ||
    /[ぁ-ゟ゠-ヿ]/.test(text) ||
    /[一-龯]/.test(text)
  );
}
