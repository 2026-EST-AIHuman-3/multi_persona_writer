import json
import random
from pathlib import Path
from collections import Counter

random.seed(42)

input_path = Path("fiction_dataset/raw/final_dataset_with_category_type.jsonl")
output_dir = Path("fiction_dataset/processed")
output_dir.mkdir(exist_ok=True)

# 1. 데이터 읽기
data = []
with open(input_path, "r", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            data.append(json.loads(line))

print("전체 데이터:", len(data))

# 2. category + type 기준으로 그룹 나누기
groups = {}

for item in data:
    key = (item["category"], item["type"])

    if key not in groups:
        groups[key] = []

    groups[key].append(item)

# 3. 각 그룹별로 8:1:1 분할
train = []
valid = []
test = []

for key, items in groups.items():
    random.shuffle(items)

    n = len(items)
    n_train = int(n * 0.8)
    n_valid = int(n * 0.1)

    train_items = items[:n_train]
    valid_items = items[n_train:n_train + n_valid]
    test_items = items[n_train + n_valid:]

    train.extend(train_items)
    valid.extend(valid_items)
    test.extend(test_items)

# 4. 전체 개수 보정
# 목표: train 81, valid 10, test 10
target_train = 81
target_valid = 10
target_test = 10

# train이 부족하면 test에서 train으로 이동
while len(train) < target_train and len(test) > target_test:
    train.append(test.pop())

# valid가 부족하면 test에서 valid로 이동
while len(valid) < target_valid and len(test) > target_test:
    valid.append(test.pop())

# train이 많으면 train에서 valid/test로 이동
while len(train) > target_train:
    if len(valid) < target_valid:
        valid.append(train.pop())
    else:
        test.append(train.pop())

# valid가 많으면 valid에서 test로 이동
while len(valid) > target_valid:
    test.append(valid.pop())

# test가 많고 valid가 부족하면 test에서 valid로 이동
while len(test) > target_test and len(valid) < target_valid:
    valid.append(test.pop())

# test에 revision이 2개 들어가도록 보정
target_test_revision = 2

while sum(item["type"] == "revision" for item in test) < target_test_revision:
    # train에서 revision 하나 꺼내기
    revision_from_train = next(i for i, item in enumerate(train) if item["type"] == "revision")
    rev_item = train.pop(revision_from_train)

    # test에서 generation 하나 꺼내기
    generation_from_test = next(i for i, item in enumerate(test) if item["type"] == "generation")
    gen_item = test.pop(generation_from_test)

    # 서로 교환
    train.append(gen_item)
    test.append(rev_item)

# 5. 각 split 내부 섞기
random.shuffle(train)
random.shuffle(valid)
random.shuffle(test)

# 6. 학습용 저장 시에는 category/type 제거하고 instruction/output만 저장
def save_jsonl(path, items):
    with open(path, "w", encoding="utf-8") as f:
        for item in items:
            clean_item = {
                "instruction": item["instruction"],
                "output": item["output"]
            }
            f.write(json.dumps(clean_item, ensure_ascii=False) + "\n")

save_jsonl(output_dir / "train.jsonl", train)
save_jsonl(output_dir / "valid.jsonl", valid)
save_jsonl(output_dir / "test.jsonl", test)

# 7. 분할 결과 확인
def print_stats(name, items):
    print(f"\n[{name}]")
    print("개수:", len(items))
    print("type:", Counter(item["type"] for item in items))
    print("category:", Counter(item["category"] for item in items))
    print("category + type:", Counter((item["category"], item["type"]) for item in items))

print_stats("train", train)
print_stats("valid", valid)
print_stats("test", test)

print("\n총합:", len(train) + len(valid) + len(test))