import json
import os

import modal


app = modal.App("clikb-h3-access-test")
image = modal.Image.debian_slim(python_version="3.12").pip_install("huggingface_hub")


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
def verify_h3_access() -> dict[str, object]:
    from huggingface_hub import hf_hub_download

    model_index_path = hf_hub_download(
        repo_id="MiniMaxAI/MiniMax-H3",
        filename="model_index.json",
        token=os.environ["HF_TOKEN"],
    )

    with open(model_index_path, "r", encoding="utf-8") as model_index_file:
        model_index = json.load(model_index_file)

    return {
        "status": "ok",
        "repository": "MiniMaxAI/MiniMax-H3",
        "file": "model_index.json",
        "model_class": model_index.get("_class_name", "unknown"),
    }


@app.local_entrypoint()
def main() -> None:
    print(verify_h3_access.remote())
