import subprocess

import modal


app = modal.App("clikb-h3-ref2va-environment-check")

sglang_image = (
    modal.Image.from_registry("lmsysorg/sglang:dev")
    .run_commands(
        'cd /sgl-workspace/sglang && pip install -e "python[diffusion]"',
    )
    .env(
        {
            "PYTHONUNBUFFERED": "1",
            "NCCL_DEBUG": "WARN",
            "TOKENIZERS_PARALLELISM": "false",
        }
    )
)


@app.function(image=sglang_image, cpu=2, memory=4096, timeout=10 * 60)
def check() -> dict[str, object]:
    command = subprocess.run(
        ["sglang", "serve", "--help"],
        check=True,
        capture_output=True,
        text=True,
    )
    help_text = command.stdout + command.stderr
    required_flags = [
        "--model-variant",
        "--num-gpus",
        "--tp-size",
        "--ulysses-degree",
        "--encoder-parallel",
        "--performance-mode",
    ]
    missing_flags = [flag for flag in required_flags if flag not in help_text]
    if missing_flags:
        raise RuntimeError(f"SGLang image is missing required flags: {missing_flags}")
    return {"status": "ready", "required_flags": required_flags}


@app.local_entrypoint()
def main() -> None:
    print(check.remote())
