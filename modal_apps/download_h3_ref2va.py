import os
from pathlib import Path

import modal


APP_NAME = "clikb-h3-ref2va-download"
VOLUME_NAME = "clikb-minimax-h3-ref2va"
MODEL_REVISION = "42ed227ee7df40d41602854ae760620d6eb651fe"
MODEL_ROOT = Path("/models/MiniMax-H3")

app = modal.App(APP_NAME)
model_volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)
download_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("huggingface_hub==1.28.0")
)


@app.function(
    image=download_image,
    cpu=4,
    memory=8192,
    timeout=24 * 60 * 60,
    secrets=[modal.Secret.from_name("huggingface-secret")],
    volumes={"/models": model_volume},
)
def download_ref2va() -> dict[str, object]:
    from huggingface_hub import snapshot_download

    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    resolved_path = snapshot_download(
        repo_id="MiniMaxAI/MiniMax-H3",
        revision=MODEL_REVISION,
        local_dir=str(MODEL_ROOT),
        allow_patterns=[
            "model_index.json",
            "LICENSE*",
            "NOTICE*",
            "README.md",
            "Ref2VA/**",
        ],
        token=os.environ["HF_TOKEN"],
        max_workers=8,
    )

    required_files = [
        MODEL_ROOT / "model_index.json",
        MODEL_ROOT / "Ref2VA" / "model_index.json",
    ]
    missing = [str(path) for path in required_files if not path.is_file()]
    if missing:
        raise RuntimeError(f"Ref2VA download is incomplete; missing: {missing}")

    file_count = 0
    total_bytes = 0
    for path in MODEL_ROOT.rglob("*"):
        if path.is_file() and ".cache" not in path.parts:
            file_count += 1
            total_bytes += path.stat().st_size

    model_volume.commit()
    return {
        "status": "ready",
        "volume": VOLUME_NAME,
        "model_root": resolved_path,
        "revision": MODEL_REVISION,
        "files": file_count,
        "bytes": total_bytes,
        "fl2va_downloaded": (MODEL_ROOT / "FL2VA").exists(),
    }


@app.local_entrypoint()
def main() -> None:
    print(download_ref2va.remote())
