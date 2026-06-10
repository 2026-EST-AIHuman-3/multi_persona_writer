# Qwen3-8B를 bf16으로 로드하고 LoRA adapter만 학습하는 코드
# 최종 채택 실험에 사용

import torch
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TrainingArguments,
)
from peft import LoraConfig
from trl import SFTTrainer


# =========================
# 1. 기본 설정
# =========================

model_name = "Qwen/Qwen3-8B"

train_path = "fiction_dataset/processed/train.jsonl"
valid_path = "fiction_dataset/processed/valid.jsonl"

output_dir = "adapters/qwen3-8b-novel-lora-bf16-v4"

system_prompt = """너는 한국어 감정·분위기 중심 소설 생성 챗봇이야.

규칙:
- 반드시 한국어로만 작성해.
- 출력 형식은 [소설 장면], [작가 코멘트]를 지켜.
- 소설 장면은 서술형 문체로 작성해.
- 감정을 직접 설명하기보다 분위기와 행동으로 보여줘.
- 대사는 짧고 자연스럽게 써.
- 작가 코멘트는 1~2문장으로 짧게 작성해.
- 작가 코멘트는 부드러운 존댓말로 작성해.
- 분석문처럼 길게 설명하지 마."""


# =========================
# 2. 데이터셋 불러오기
# =========================

dataset = load_dataset(
    "json",
    data_files={
        "train": train_path,
        "validation": valid_path,
    },
)

print(dataset)


# =========================
# 3. 토크나이저 불러오기
# =========================

tokenizer = AutoTokenizer.from_pretrained(
    model_name,
    trust_remote_code=True,
)

# Qwen 계열은 pad_token이 비어 있을 수 있어서 eos_token으로 맞춰줌
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token


# =========================
# 4. 학습용 텍스트 포맷 만들기
# =========================

def formatting_func(example):
    messages = [
        {
            "role": "system",
            "content": system_prompt,
        },
        {
            "role": "user",
            "content": example["instruction"],
        },
        {
            "role": "assistant",
            "content": example["output"],
        },
    ]

    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
        enable_thinking=False,
    )

    return text


# =========================
# 5. 모델 불러오기
# =========================

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True,
)

# 학습 중 VRAM 절약
model.gradient_checkpointing_enable()

# 캐시 사용 끄기
# gradient checkpointing 쓸 때는 보통 꺼주는 게 안전함
model.config.use_cache = False


# =========================
# 6. LoRA 설정
# =========================

lora_config = LoraConfig(
    r=8,
    lora_alpha=16,
    lora_dropout=0.1,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=[
        "q_proj",
        "k_proj",
        "v_proj",
        "o_proj"
    ]
)


# =========================
# 8. 학습 설정
# =========================

training_args = TrainingArguments(
    output_dir=output_dir,

    num_train_epochs=2,

    per_device_train_batch_size=1,
    per_device_eval_batch_size=1,
    gradient_accumulation_steps=8,

    learning_rate=5e-5,
    weight_decay=0.01,
    warmup_ratio=0.03,

    bf16=True,
    fp16=False,

    logging_steps=1,
    eval_strategy="epoch",
    save_strategy="epoch",

    save_total_limit=2,

    report_to="none",

    # optim="paged_adamw_8bit",
    optim="adamw_torch",

    gradient_checkpointing=True,

    remove_unused_columns=False,
)


# =========================
# 9. Trainer 만들기
# =========================

trainer = SFTTrainer(
    model=model,
    processing_class=tokenizer,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    peft_config=lora_config,
    formatting_func=formatting_func,
)

# =========================
# 10. 학습 시작
# =========================

trainer.train()


# =========================
# 11. LoRA 어댑터 저장
# =========================

trainer.save_model(output_dir)
tokenizer.save_pretrained(output_dir)

print(f"학습 완료! LoRA adapter 저장 위치: {output_dir}")