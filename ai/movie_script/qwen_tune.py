# pip install transformers peft trl accelerate bitsandbytes datasets
# cd /smhrd/MoonMac/JHC/LLM_Project
# 실행 python3 /smhrd/MoonMac/JHC/LLM_Project/qwen_tune.py

# 라이브러리 불러오기
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer, SFTConfig
from datasets import load_dataset
import torch

# 모델 정의
model_name = "Qwen/Qwen3-8B"

# 데이터 로드 및 변환
dataset = load_dataset("json", data_files="/smhrd/MoonMac/JHC/data/*.json", split="train")
print("원본 데이터 수:", len(dataset))

def format_alpaca_to_chat(example):
    user_prompt = example["instruction"]
    if example["input"] and example["input"].strip():
        user_prompt += f"\n\n[부연 설명]\n{example['input']}"
    return {
        "messages": [
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": example["output"]}
        ]
    }

dataset = dataset.map(format_alpaca_to_chat, remove_columns=dataset.column_names)

# 토크나이저 로드
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3-8B")

# 토큰 길이 측정
prompt_tokens = []
response_tokens = []

for example in dataset:
    for msg in example["messages"]:
        token_len = len(tokenizer.encode(msg["content"], add_special_tokens=False))
        if msg["role"] == "user":
            prompt_tokens.append(token_len)
        elif msg["role"] == "assistant":
            response_tokens.append(token_len)

print("=== 토큰 기준 ===")
print(f"평균 프롬프트 길이 : {sum(prompt_tokens) / len(prompt_tokens):.1f} tokens")
print(f"평균 답변 길이     : {sum(response_tokens) / len(response_tokens):.1f} tokens")
print(f"최대 프롬프트 길이 : {max(prompt_tokens)} tokens")
print(f"최대 답변 길이     : {max(response_tokens)} tokens")
print(f"프롬프트+답변 최대 합산 : {max(p + r for p, r in zip(prompt_tokens, response_tokens))} tokens")

# train, validation, test 데이터셋으로 분할
train_test = dataset.train_test_split(test_size=0.2, seed=42)
train_dataset = train_test["train"]
temp_dataset = train_test["test"]

valid_test = temp_dataset.train_test_split(test_size=0.5, seed=42)
valid_dataset = valid_test["train"]
test_dataset = valid_test["test"]

print(len(train_dataset))
print(len(valid_dataset))
print(len(test_dataset))

# 4비트 양자화 설정
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16
)

# 모델, 토크나이저 불러오기
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=bnb_config,            # [수정] 누락되었던 양자화 설정 추가
    torch_dtype=torch.bfloat16,                # [수정] 데이터 타입 bf16으로 통일
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# k-bit 학습을 위한 준비
model = prepare_model_for_kbit_training(model)

# LoRA 설정
lora_config = LoraConfig(
    r=16,                          # rank
    lora_alpha=32,                 # alpha
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# 학습 설정 및 실행
training_config = SFTConfig(
    output_dir="/smhrd/MoonMac/JHC/LLM_Project/lora-qwen3",
    num_train_epochs=3,
    per_device_train_batch_size=1,
    gradient_accumulation_steps=8,
    learning_rate=2e-4,
    warmup_ratio=0.03,
    lr_scheduler_type="cosine",
    bf16=True,                                 # [수정] fp16=True 대신 bf16=True 사용 (컴퓨트 타입 호환)
    logging_steps=10,
    save_steps=100,
)

trainer = SFTTrainer(
    model=model,
    train_dataset=train_dataset,
    eval_dataset=valid_dataset,
    args=training_config,
    processing_class=tokenizer,
)

trainer.train()
