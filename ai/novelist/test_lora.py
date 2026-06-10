import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import PeftModel


# =========================
# 1. 경로 설정
# =========================

base_model_name = "Qwen/Qwen3-8B"
adapter_path = "adapters/qwen3-8b-novel-lora-bf16-v4"

# system_prompt = """너는 한국어 감정·분위기 중심 소설 생성 챗봇이야.

# 규칙:
# - 반드시 한국어로만 작성해.
# - 중국어, 영어, 일본어, 한자 표현을 사용하지 마.
# - 모든 대사도 반드시 한국어로 작성해.
# - 출력 형식은 [소설 장면], [작가 코멘트]를 지켜.
# - 소설 장면은 서술형 문체로 작성해.
# - 감정을 직접 설명하기보다 분위기, 행동, 감각 묘사로 보여줘.
# - 대사는 짧고 자연스럽게 써.
# - 작가 코멘트는 1~2문장으로 짧게 작성해.
# - 작가 코멘트는 부드러운 존댓말(해요체)로 작성해.
# - 분석문처럼 길게 설명하지 마.
# - 수정 요청에서는 원문의 장르와 상황을 유지하고, 요청받은 부분만 바꿔.
# - 수정 요청에서 새로운 사건이나 공포 요소를 임의로 추가하지 마."""

system_prompt = """너는 한국어 감정·분위기 중심 소설 생성 챗봇이야.
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
- “~해봤어요.”, “~구성해봤어요.”, “~표현해봤어요.”처럼 끝내.
- “전달합니다”, “구성했습니다”, “유발하려 합니다”, “느끼게 합니다” 같은 딱딱한 분석문 말투를 사용하지 마.
- 작가 코멘트에는 장면에서 신경 쓴 분위기, 감정선, 묘사 방식을 짧게 설명해."""


# =========================
# 2. 토크나이저 불러오기
# =========================

tokenizer = AutoTokenizer.from_pretrained(
    adapter_path,
    trust_remote_code=True,
)

if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token


# =========================
# 3. 4bit 설정
# =========================

# bnb_config = BitsAndBytesConfig(
#     load_in_4bit=True,
#     bnb_4bit_quant_type="nf4",
#     bnb_4bit_compute_dtype=torch.bfloat16,
#     bnb_4bit_use_double_quant=True,
# )


# =========================
# 4. 원본 모델 불러오기
# =========================

base_model = AutoModelForCausalLM.from_pretrained(
    base_model_name,
    # quantization_config=bnb_config,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True,
)


# =========================
# 5. LoRA adapter 붙이기
# =========================

model = PeftModel.from_pretrained(
    base_model,
    adapter_path,
)

model.eval()


# =========================
# 6. 생성 함수
# =========================

def generate_answer(user_prompt):
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
        enable_thinking=False,
    )

    inputs = tokenizer(text, return_tensors="pt").to(model.device)

    with torch.no_grad():
       generated_ids = model.generate(
        **inputs,
        max_new_tokens=700,
        do_sample=False,
        repetition_penalty=1.1,
        pad_token_id=tokenizer.eos_token_id,
    )

    generated_ids = generated_ids[:, inputs.input_ids.shape[-1]:]
    result = tokenizer.decode(generated_ids[0], skip_special_tokens=True)

    return result.strip()


# =========================
# 7. 반복 테스트
# =========================

while True:
    prompt = input("\n프롬프트 입력 >> ").strip()

    if prompt.lower() in ["q", "quit", "exit", "종료"]:
        print("종료합니다.")
        break

    if prompt == "":
        print("빈 입력입니다. 다시 입력해 주세요.")
        continue

    result = generate_answer(prompt)

    print("\n===== LoRA 결과 =====")
    print(result)