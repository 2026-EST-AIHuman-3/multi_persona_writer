import { Manuscript } from "@/types";

const STORAGE_KEY = "persona-writer-manuscripts-v1";

function getWordsCount(str: string): number {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

export function loadManuscripts(): Manuscript[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(manuscripts: Manuscript[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(manuscripts));
}

export function saveManuscript(data: Partial<Manuscript>): Manuscript {
  const manuscripts = loadManuscripts();

  // 업데이트
  if (data.id) {
    const idx = manuscripts.findIndex((m) => m.id === data.id);
    if (idx !== -1) {
      manuscripts[idx] = {
        ...manuscripts[idx],
        ...data,
        wordCount: data.content != null ? getWordsCount(data.content) : manuscripts[idx].wordCount,
      };
      persist(manuscripts);
      return manuscripts[idx];
    }
  }

  // 새로 생성
  const newManuscript: Manuscript = {
    id: `m-${Date.now()}`,
    title: data.title || "무제 원고",
    content: data.content || "",
    prompt: data.prompt || "",
    personaId: data.personaId || "novel",
    loraAdapter: data.loraAdapter || "General style",
    createdAt: new Date().toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    }),
    status: data.status || "draft",
    wordCount: getWordsCount(data.content || ""),
  };

  manuscripts.unshift(newManuscript);
  persist(manuscripts);
  return newManuscript;
}

export function deleteManuscript(id: string): void {
  const manuscripts = loadManuscripts().filter((m) => m.id !== id);
  persist(manuscripts);
}
