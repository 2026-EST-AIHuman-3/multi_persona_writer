# Persona Writer Studio

> AI 작가 페르소나 기반 창작 지원 스튜디오 — llama.cpp / vLLM / Gemini 멀티 백엔드 지원

**Persona Writer Studio**는 소설가, 영화 시나리오, 게임 시나리오, 광고 카피 등 다양한 작가 페르소나와 LoRA 어댑터를 결합한 전문 창작 AI 스튜디오입니다. 창작 맥락을 유지하면서 여러 페르소나를 자유롭게 전환하며 원고를 작성하고 아카이브할 수 있습니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **멀티 페르소나** | 소설가, 영화 시나리오, 게임 시나리오(50/500 체크포인트), 광고 카피 6종 기본 제공 |
| **LoRA 런타임 전환** | llama.cpp의 `/lora-adapters` API로 요청마다 페르소나별 어댑터 자동 적용 |
| **게임 시나리오 플로우** | 장르·세계관·주인공·분기 그래프까지 단계별 인터랙티브 시나리오 설계 |
| **원고 아카이브** | 생성 원고를 저장·조회·편집, JSON 내보내기 지원 |
| **스타일 비교 뷰** | 동일 프롬프트를 여러 페르소나로 동시 생성·비교 |
| **품질 자동 수정** | 외래 문자(키릴, 한자 등) 감지 시 자동 재생성 파이프라인 |
| **멀티 백엔드** | `llamacpp` · `vllm` · `gemini` 세 가지 모델 백엔드 지원 |

---

## 기술 스택

- **Frontend**: Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS v4
- **Animation**: Motion (Framer Motion v12)
- **Icons**: Lucide React
- **Backend**: Next.js API Routes (`/api/generate-manuscript`, `/api/manuscripts`)
- **AI 백엔드**: llama.cpp server / vLLM / Google Gemini API

---

## 로컬 실행

### 사전 요구사항

- Node.js 20+
- llama.cpp 서버 또는 vLLM 서버 (GPU 서버 SSH 터널 권장)

### 설치

```bash
git clone https://github.com/2026-EST-AIHuman-3/multi_persona_writer.git
cd multi_persona_writer
npm install
```

### 환경변수 설정

```bash
cp .env.example .env
```

`.env`를 열고 사용 환경에 맞게 수정합니다.

```env
# 사용할 모델 백엔드 선택: llamacpp | vllm | gemini
MODEL_PROVIDER="llamacpp"

# llama.cpp 서버 (SSH 터널 예시)
# ssh -p 30543 -L 8088:127.0.0.1:8088 root@<GPU_SERVER_IP>
LLAMACPP_BASE_URL="http://127.0.0.1:8088"
LLAMACPP_MODEL="qwen3-8b-v4-lora-llamacpp"

# LoRA 런타임 전환 (페르소나별 어댑터 ID)
LLAMACPP_LORA_RUNTIME_SWITCH="true"
LLAMACPP_LORA_GAME_ID="1"
LLAMACPP_LORA_MOVIE_ID="3"
LLAMACPP_LORA_NOVEL_ID="2"

# Gemini (fallback 또는 MODEL_PROVIDER="gemini" 시)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

전체 환경변수 목록은 [`.env.example`](.env.example)을 참고하세요.

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열면 됩니다.

---

## llama.cpp 서버 설정 가이드

페르소나별 LoRA를 런타임에 전환하려면 llama-server를 다음과 같이 실행합니다.

```bash
llama-server \
  -m BASE.gguf \
  --lora game.gguf \
  --lora movie.gguf \
  --lora novel.gguf \
  --lora ad.gguf \
  --lora-init-without-apply \
  --host 127.0.0.1 \
  --port 8088
```

GPU 서버에서 실행 후 로컬에서 SSH 터널로 연결합니다.

```bash
ssh -p <PORT> -L 8088:127.0.0.1:8088 root@<GPU_SERVER_IP>
```

---

## vLLM 서버 설정 가이드

```bash
vllm serve Qwen/Qwen3-8B \
  --host 127.0.0.1 \
  --port 8000 \
  --enable-lora \
  --lora-modules qwen3-8b-game-lora=/path/to/adapter
```

`.env`에서 `MODEL_PROVIDER="vllm"` 및 `VLLM_BASE_URL`을 설정합니다.

---

## 프로젝트 구조

```
Persona-Writer-Studio/
├── app/
│   ├── api/
│   │   ├── generate-manuscript/   # 원고 생성 API (llamacpp / vllm / gemini 분기)
│   │   └── manuscripts/           # 원고 CRUD API
│   ├── login/                     # 로그인 페이지
│   ├── globals.css                # 디자인 토큰 (다크 에디토리얼 테마)
│   ├── layout.tsx
│   └── page.tsx                   # 메인 앱 (탭 라우팅)
├── components/
│   ├── EditorView.tsx             # 채팅형 원고 편집기 + 파라미터 패널
│   ├── ArchiveView.tsx            # 원고 아카이브
│   ├── ComparisonView.tsx         # 멀티 페르소나 비교
│   ├── LandingView.tsx            # 랜딩 페이지
│   ├── Header.tsx                 # 상단 내비게이션
│   └── Sidebar.tsx                # 페르소나 선택 사이드바
├── lib/
│   └── scenario/                  # 게임 시나리오 플로우 엔진
│       ├── prompt-builder.ts      # 시스템/유저 프롬프트 빌더
│       ├── selection-flow.ts      # 단계별 선택 플로우
│       ├── branch-graph.ts        # 분기 그래프 생성
│       ├── state-manager.ts       # 시나리오 상태 관리
│       ├── quality-check.ts       # 출력 품질 검증
│       └── exporter.ts            # JSON 내보내기
├── types/                         # TypeScript 타입 정의
├── .env.example                   # 환경변수 예시
└── next.config.ts
```

---

## 페르소나 목록

| ID | 이름 | LoRA 어댑터 | 특징 |
|----|------|-------------|------|
| `novel` | 소설가 | `LoRA: LITERARY_DARK` | 감정·분위기 중심, [소설 장면] + [작가 코멘트] 형식 출력 |
| `movie` | 영화 시나리오 | `LoRA: Noir_v3` | 대사·지문, 신(Scene) 구성 최적화 |
| `game` | 게임 시나리오 | `LoRA: Qwen3_Game_500_Final` | 단계별 인터랙티브 분기 플로우 |
| `game-50` | 게임 시나리오 50 | `LoRA: Qwen3_Game_Checkpoint_50` | 50 스텝 체크포인트 비교용 |
| `game-500` | 게임 시나리오 500 | `LoRA: Qwen3_Game_500_Final` | 500 스텝 최종 LoRA 비교용 |
| `ad` | 광고 카피 | `LoRA: Luxury_Brand_Voice` | 프리미엄 브랜드 에디토리얼 어조 |

---

## 라이선스

Apache-2.0