export function detectQualityWarnings(text: string): string[] {
  const warnings: string[] = [];
  if (/[ぁ-ゟ゠-ヿ]/.test(text)) warnings.push("일본어 토큰이 포함됨");
  if (/[一-龯]/.test(text)) warnings.push("중국어/한자 토큰이 포함됨");
  if (/[А-Яа-яЁё]/.test(text)) warnings.push("키릴 문자 토큰이 포함됨");
  if (/[Đđ]/.test(text)) warnings.push("의미 없는 로마자/베트남어 혼입 토큰이 포함됨");
  if (/[A-Za-z]{3,}(?:\s+[A-Za-z]{2,}){2,}/.test(text)) {
    warnings.push("영어 구절이 한국어 원고에 혼입됨");
  }
  if (/(^|[^A-Za-z])[A-Za-z]{2,}($|[^A-Za-z])/.test(text)) {
    warnings.push("영어/로마자 토큰이 한국어 원고에 혼입됨");
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 12);
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line, (counts.get(line) || 0) + 1);
  const repeated = [...counts.entries()].find(([, count]) => count >= 3);
  if (repeated) warnings.push(`같은 문장이 3회 이상 반복됨: ${repeated[0].slice(0, 60)}`);

  const speakerLabels = text
    .split(/\r?\n/)
    .map((line) => line.match(/^([^:\n]{12,80}):/)?.[1]?.trim())
    .filter(Boolean) as string[];
  const longSpeaker = speakerLabels.find((label) => label.length >= 18 || /[A-Za-z]/.test(label));
  if (longSpeaker) warnings.push(`긴 설정 문장 또는 외국어가 화자명으로 사용됨: ${longSpeaker.slice(0, 60)}`);

  const phraseCounts = new Map<string, number>();
  for (const line of lines) {
    const normalized = line.replace(/[“”"'()[\]{}.,!?]/g, " ").replace(/\s+/g, " ").trim();
    const words = normalized.split(" ").filter((word) => word.length >= 2);
    for (let size = 4; size <= 8; size += 1) {
      for (let index = 0; index + size <= words.length; index += 1) {
        const phrase = words.slice(index, index + size).join(" ");
        if (phrase.length < 18) continue;
        phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
      }
    }
  }
  const repeatedPhrase = [...phraseCounts.entries()].find(([, count]) => count >= 3);
  if (repeatedPhrase) warnings.push(`같은 표현이 과도하게 반복됨: ${repeatedPhrase[0].slice(0, 60)}`);

  return warnings;
}
