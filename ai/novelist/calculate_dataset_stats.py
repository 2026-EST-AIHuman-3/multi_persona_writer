import json
from transformers import AutoTokenizer

model_name = "Qwen/Qwen3-8B"
tokenizer = AutoTokenizer.from_pretrained(model_name)

# 데이터셋 파일은 GitHub에 포함하지 않았습니다.
# 실행 전 아래 경로에 train/valid/test jsonl 파일을 준비하거나,
# 각자 환경에 맞게 file_paths를 수정해 주세요.
file_paths = [
    "fiction_dataset/processed/train.jsonl",
    "fiction_dataset/processed/valid.jsonl",
    "fiction_dataset/processed/test.jsonl",
]

prompt_lengths = []
answer_lengths = []

for file_path in file_paths:
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            data = json.loads(line)

            instruction = data["instruction"]
            output = data["output"]

            prompt_tokens = tokenizer(instruction, add_special_tokens=False)["input_ids"]
            answer_tokens = tokenizer(output, add_special_tokens=False)["input_ids"]

            prompt_lengths.append(len(prompt_tokens))
            answer_lengths.append(len(answer_tokens))

print("전체 데이터 개수:", len(prompt_lengths))
print("평균 프롬프트 길이:", round(sum(prompt_lengths) / len(prompt_lengths), 1), "tokens")
print("평균 답변 길이:", round(sum(answer_lengths) / len(answer_lengths), 1), "tokens")
print("최소 프롬프트 길이:", min(prompt_lengths))
print("최대 프롬프트 길이:", max(prompt_lengths))
print("최소 답변 길이:", min(answer_lengths))
print("최대 답변 길이:", max(answer_lengths))

# ---출력---
# 전체 데이터 개수: 101
# 평균 프롬프트 길이: 79.7 tokens
# 평균 답변 길이: 281.1 tokens
# 최소 프롬프트 길이: 28
# 최대 프롬프트 길이: 286
# 최소 답변 길이: 204
# 최대 답변 길이: 361