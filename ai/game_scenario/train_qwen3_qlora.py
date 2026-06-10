#!/usr/bin/env python3
import argparse
import json
import math
import time
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-name", default="Qwen/Qwen3-8B")
    parser.add_argument("--train-file", required=True)
    parser.add_argument("--eval-file", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--max-length", type=int, default=3072)
    parser.add_argument("--epochs", type=float, default=2.0)
    parser.add_argument("--max-steps", type=int, default=-1)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--grad-accum", type=int, default=8)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--lora-alpha", type=int, default=32)
    parser.add_argument("--lora-dropout", type=float, default=0.05)
    parser.add_argument("--eval-limit", type=int, default=64)
    parser.add_argument("--skip-eval", action="store_true")
    parser.add_argument("--report-only", action="store_true")
    parser.add_argument("--save-every-steps", type=int, default=0)
    return parser.parse_args()


def load_rows(path):
    with Path(path).open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def validate_rows(train_rows, eval_rows):
    for name, rows in (("train", train_rows), ("eval", eval_rows)):
        if not rows:
            raise ValueError(f"{name} rows are empty")
        for index, row in enumerate(rows, start=1):
            roles = [message.get("role") for message in row.get("messages", [])]
            if roles != ["system", "system", "user", "assistant"]:
                raise ValueError(f"{name} row {index}: unexpected roles {roles}")
    train_scenarios = {row.get("metadata", {}).get("scenario") for row in train_rows}
    eval_scenarios = {row.get("metadata", {}).get("scenario") for row in eval_rows}
    overlap = sorted(train_scenarios & eval_scenarios)
    if overlap:
        raise ValueError(f"train/eval scenario overlap: {overlap}")


def row_report(rows):
    scenarios = sorted({row.get("metadata", {}).get("scenario") for row in rows})
    chars = [
        sum(len(message.get("content", "")) for message in row.get("messages", []))
        for row in rows
    ]
    ordered = sorted(chars)
    p95_index = min(len(ordered) - 1, int(len(ordered) * 0.95))
    return {
        "samples": len(rows),
        "scenarios": len(scenarios),
        "min_chars": min(chars),
        "max_chars": max(chars),
        "mean_chars": round(sum(chars) / len(chars), 2),
        "p95_chars": ordered[p95_index],
    }


def load_tokenizer(model_name):
    from transformers import AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        trust_remote_code=True,
        local_files_only=True,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    return tokenizer


def apply_prompt_template(tokenizer, messages):
    try:
        return tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=False,
        )
    except TypeError:
        return tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )


def encode_row(tokenizer, row, max_length):
    prompt = apply_prompt_template(tokenizer, row["messages"][:-1])
    completion = row["messages"][-1]["content"] + tokenizer.eos_token
    prompt_ids = tokenizer(prompt, add_special_tokens=False)["input_ids"]
    full_ids = tokenizer(prompt + completion, add_special_tokens=False)["input_ids"]
    labels = [-100] * len(prompt_ids) + full_ids[len(prompt_ids):]
    if len(full_ids) > max_length:
        full_ids = full_ids[:max_length]
        labels = labels[:max_length]
    if all(label == -100 for label in labels):
        labels[-1] = full_ids[-1]
    return {"input_ids": full_ids, "labels": labels}


def token_report(tokenizer, rows, max_length):
    lengths = []
    truncated = 0
    for row in rows:
        encoded = encode_row(tokenizer, row, 10**9)
        length = len(encoded["input_ids"])
        lengths.append(length)
        truncated += int(length > max_length)
    ordered = sorted(lengths)
    p95_index = min(len(ordered) - 1, int(len(ordered) * 0.95))
    return {
        "samples": len(lengths),
        "min_tokens": min(lengths),
        "max_tokens": max(lengths),
        "mean_tokens": round(sum(lengths) / len(lengths), 2),
        "p95_tokens": ordered[p95_index],
        "truncated_samples": truncated,
    }


class ChatDataset:
    def __init__(self, tokenizer, rows, max_length):
        self.samples = [encode_row(tokenizer, row, max_length) for row in rows]

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        return self.samples[index]


def make_collate(tokenizer):
    pad_id = tokenizer.pad_token_id

    def collate(samples):
        import torch

        max_len = max(len(sample["input_ids"]) for sample in samples)
        input_ids = []
        labels = []
        attention_mask = []
        for sample in samples:
            pad_len = max_len - len(sample["input_ids"])
            input_ids.append(sample["input_ids"] + [pad_id] * pad_len)
            labels.append(sample["labels"] + [-100] * pad_len)
            attention_mask.append([1] * len(sample["input_ids"]) + [0] * pad_len)
        return {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "labels": torch.tensor(labels, dtype=torch.long),
            "attention_mask": torch.tensor(attention_mask, dtype=torch.long),
        }

    return collate


def load_model(args):
    import torch
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, BitsAndBytesConfig

    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )
    model = AutoModelForCausalLM.from_pretrained(
        args.model_name,
        quantization_config=quantization_config,
        device_map={"": 0},
        torch_dtype=torch.bfloat16,
        trust_remote_code=True,
        local_files_only=True,
    )
    model.config.use_cache = False
    model = prepare_model_for_kbit_training(
        model,
        use_gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
    )
    lora_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
    )
    return get_peft_model(model, lora_config)


def evaluate(model, loader, limit):
    import torch

    model.eval()
    losses = []
    with torch.no_grad():
        for index, batch in enumerate(loader, start=1):
            if limit > 0 and index > limit:
                break
            batch = {key: value.to(model.device) for key, value in batch.items()}
            loss = model(**batch).loss
            losses.append(float(loss.detach().cpu()))
    model.train()
    if not losses:
        return None
    return sum(losses) / len(losses)


def main():
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    train_rows = load_rows(args.train_file)
    eval_rows = load_rows(args.eval_file)
    validate_rows(train_rows, eval_rows)

    base_report = {
        "model_name": args.model_name,
        "max_length": args.max_length,
        "train": row_report(train_rows),
        "eval": row_report(eval_rows),
    }
    if args.report_only:
        print(json.dumps(base_report, ensure_ascii=False, indent=2), flush=True)
        Path(output_dir, "dataset_report.json").write_text(
            json.dumps(base_report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return

    import torch
    from torch.utils.data import DataLoader

    tokenizer = load_tokenizer(args.model_name)
    report = {
        "model_name": args.model_name,
        "max_length": args.max_length,
        "train": token_report(tokenizer, train_rows, args.max_length),
        "eval": token_report(tokenizer, eval_rows, args.max_length),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    Path(output_dir, "dataset_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    model = load_model(args)
    model.print_trainable_parameters()

    train_dataset = ChatDataset(tokenizer, train_rows, args.max_length)
    eval_dataset = ChatDataset(tokenizer, eval_rows, args.max_length)
    collate = make_collate(tokenizer)
    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=collate,
    )
    eval_loader = DataLoader(
        eval_dataset,
        batch_size=1,
        shuffle=False,
        collate_fn=collate,
    )

    trainable = [param for param in model.parameters() if param.requires_grad]
    optimizer = torch.optim.AdamW(trainable, lr=args.lr)
    total_batches = math.ceil(len(train_loader) * args.epochs)
    total_steps = total_batches // max(args.grad_accum, 1)
    if args.max_steps > 0:
        total_steps = min(total_steps, args.max_steps)
    print(f"training total_optimizer_steps={total_steps}", flush=True)

    model.train()
    optimizer.zero_grad(set_to_none=True)
    global_step = 0
    micro_step = 0
    start_time = time.time()
    stop_training = False
    epochs = int(math.ceil(args.epochs))

    for epoch in range(epochs):
        if stop_training:
            break
        for batch in train_loader:
            micro_step += 1
            batch = {key: value.to(model.device) for key, value in batch.items()}
            loss = model(**batch).loss / args.grad_accum
            loss.backward()
            if micro_step % args.grad_accum != 0:
                continue

            torch.nn.utils.clip_grad_norm_(trainable, 1.0)
            optimizer.step()
            optimizer.zero_grad(set_to_none=True)
            global_step += 1

            elapsed = time.time() - start_time
            print(
                json.dumps(
                    {
                        "step": global_step,
                        "epoch": epoch + 1,
                        "loss": round(float(loss.detach().cpu()) * args.grad_accum, 6),
                        "elapsed_sec": round(elapsed, 1),
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )

            if args.save_every_steps and global_step % args.save_every_steps == 0:
                checkpoint = output_dir / f"checkpoint-{global_step}"
                model.save_pretrained(checkpoint)

            if args.max_steps > 0 and global_step >= args.max_steps:
                stop_training = True
                break   

        if not args.skip_eval and not stop_training:
            eval_loss = evaluate(model, eval_loader, args.eval_limit)
            print(
                json.dumps(
                    {"epoch": epoch + 1, "eval_loss": None if eval_loss is None else round(eval_loss, 6)},
                    ensure_ascii=False,
                ),
                flush=True,
            )

    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"saved_adapter={output_dir}", flush=True)


if __name__ == "__main__":
    main()
