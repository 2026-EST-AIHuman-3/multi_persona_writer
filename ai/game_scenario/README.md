# Qwen3-8B Stateful QLoRA 파인튜닝 스크립트

이 디렉토리는 **Persona-Writer-Studio**의 게임 시나리오 라이터 페르소나 모델(Qwen3-8B 기반)을 학습하기 위한 파인튜닝 스크립트와 관련 설정 파일을 포함하고 있습니다.
메모리 효율적인 파인튜닝을 위해 4비트 양자화 기법인 **QLoRA**와 PyTorch Native Training Loop가 적용되었습니다.

---

## 📌 주요 특징

* **QLoRA (4-bit Double Quantization)**: BitsAndBytesConfig 및 NF4 양자화를 사용하여 8B 파라미터 모델을 단일 Consumer GPU 환경(예: RTX 3090/4090)에서도 원활하게 학습할 수 있습니다.
* **Stateful 학습 데이터 구조 검증**: 시스템 상태 정보 및 대화 기록 흐름을 관리하기 위한 특수한 Role 구조(`system` x2, `user` x1, `assistant` x1) 유효성 검사를 엄격히 진행합니다.
* **데이터셋 시나리오 유출(Data Leakage) 방지**: 학습용 데이터와 평가용 데이터셋 사이에 동일한 시나리오 ID가 겹치지 않도록 사전에 메타데이터를 전수 조사하고 차단합니다.
* **Dataset Report 모드**: 실제 학습 진입 전에 `--report-only` 플래그를 통해 데이터셋의 캐릭터 통계, 토큰 길이 분포, 잘림 현상(Truncation)을 미리 예측 리포트로 저장할 수 있습니다.

---

## ⚙️ 사전 요구사항 (Requirements)

파이썬 3.10 이상 및 CUDA 환경(CUDA 11.8 또는 12.x 이상)이 필요합니다. 아래 명령어로 필요한 패키지를 설치합니다.

```bash
pip install -r requirements.txt
```

---

## 🗂️ 데이터 포맷 (Data Format)

학습 데이터는 한 줄에 하나의 JSON 객체가 있는 **JSON Lines (`.jsonl`)** 형식이어야 합니다. 
본 스크립트는 **Stateful 대화 흐름**을 위해 아래와 같은 엄격한 메시지 롤 구조를 필요로 합니다.

### 데이터셋 JSON 예시

```json
{
  "metadata": {
    "scenario": "cyberpunk_neon_noir_01"
  },
  "messages": [
    { "role": "system", "content": "너는 사이버펑크 텍스트 RPG 게임 시나리오 디렉터다." },
    { "role": "system", "content": "[CURRENT_STATE]\nstage: DIRECTION_SELECTION\nconfirmed: {}" },
    { "role": "user", "content": "네온 거리에서 시작할게. 장르 선택지 줘." },
    { "role": "assistant", "content": "확정 요약: 아직 없음\n이번 단계 목적: 게임의 큰 장르 방향을 정한다.\n\n1번. 하드보일드 누아르 - 레인코트를 깃 세우고 네온 아래를 걷는 하드보일드 탐정물\n2번. 사이버네틱 액션 - 넷러너들의 해킹과 가상현실 첩보전\n3번. 직접 입력" }
  ]
}
```

* **주의**: `messages` 배열 내의 `role` 순서가 정확히 `["system", "system", "user", "assistant"]` 여야 유효성 검사(`validate_rows`)를 통과합니다.
* **시나리오 검사**: `train` 데이터셋의 `metadata.scenario` 목록과 `eval` 데이터셋의 목록에 중복되는 값이 있을 경우, 오버핏 방지를 위해 검증 단계에서 에러(`ValueError: train/eval scenario overlap`)가 발생합니다.

---

## 🚀 실행 가이드 (Usage)

### 1. 데이터셋 분석 및 사전 리포트 생성 (`--report-only`)
학습 모델을 메모리에 로드하지 않고 데이터셋 유효성 및 글자 수 통계만 확인하려면 아래 명령어를 사용합니다.

```bash
python train_qwen3_stateful_v3_qlora_torch.py \
  --train-file ./data/train_data.jsonl \
  --eval-file ./data/eval_data.jsonl \
  --output-dir ./output_report \
  --report-only
```

### 2. 실제 QLoRA 학습 실행
QLoRA 가중치 튜닝을 진행하고 최종 LoRA Adapter를 저장하는 전체 학습을 시작합니다.

```bash
python train_qwen3_stateful_v3_qlora_torch.py \
  --model-name Qwen/Qwen3-8B \
  --train-file ./data/train_data.jsonl \
  --eval-file ./data/eval_data.jsonl \
  --output-dir ./output_adapter \
  --epochs 2.0 \
  --lr 1e-4 \
  --batch-size 1 \
  --grad-accum 8 \
  --max-length 3072 \
  --save-every-steps 100
```

---

## 🛠️ 주요 실행 인자 (Arguments)

| 인자명 | 기본값 | 설명 |
| :--- | :---: | :--- |
| `--model-name` | `Qwen/Qwen3-8B` | 허깅페이스에 등록된 베이스 모델명 또는 로컬 절대 경로 |
| `--train-file` | *Required* | 학습 데이터셋 경로 (`.jsonl`) |
| `--eval-file` | *Required* | 검증 데이터셋 경로 (`.jsonl`) |
| `--output-dir` | *Required* | 결과 파일 및 LoRA Adapter 저장 경로 |
| `--max-length` | `3072` | 입력 토큰 최대 길이 제한 |
| `--epochs` | `2.0` | 학습 에폭 수 |
| `--lr` | `1e-4` | 학습률 (Learning Rate) |
| `--batch-size` | `1` | Micro batch size |
| `--grad-accum` | `8` | Gradient Accumulation step |
| `--lora-r` | `16` | LoRA Rank |
| `--lora-alpha` | `32` | LoRA Alpha |
| `--lora-dropout` | `0.05` | LoRA Dropout 비율 |
| `--save-every-steps` | `0` | 지정한 스텝 수 마다 체크포인트 어댑터를 저장 (0일 때 미저장) |
| `--skip-eval` | `False` | 에폭 종료 후 Evaluation 단계를 건너뛸지 여부 |

---

## ⚠️ 참고 및 개발자 안내

1. **로컬 파일 의존성**:
   본 스크립트는 모델 로딩 시 `local_files_only=True` 옵션이 설정되어 있어 로컬 캐시 디렉토리에 베이스 가중치가 먼저 완벽히 다운로드되어 있어야 작동합니다. 서버 환경에서 다운로드하며 진행하고 싶다면 코드의 `local_files_only` 부분을 `False`로 수정하거나 주석 처리해야 합니다.
2. **GPU 디바이스 맵핑**:
   기본적으로 `device_map={"": 0}`을 통해 GPU 0번 메모리에 강제 할당됩니다. 여러 대의 GPU가 있거나 가상 디바이스 매핑을 활용할 경우 코드를 `device_map="auto"` 등으로 유연하게 수정하는 것을 권장합니다.
