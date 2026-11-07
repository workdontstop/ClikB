import os
from collections import defaultdict

import modal


app = modal.App("clikb-h3-manifest-audit")
image = modal.Image.debian_slim(python_version="3.12").pip_install("huggingface_hub")


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
def audit_h3_manifest() -> dict[str, object]:
    from huggingface_hub import HfApi

    repo_id = "MiniMaxAI/MiniMax-H3"
    info = HfApi(token=os.environ["HF_TOKEN"]).model_info(
        repo_id=repo_id,
        files_metadata=True,
    )

    files: list[dict[str, object]] = []
    for sibling in info.siblings or []:
        path = sibling.rfilename
        size = int(sibling.size or 0)
        files.append({"path": path, "size": size})

    top_level: dict[str, dict[str, int]] = defaultdict(lambda: {"files": 0, "bytes": 0})
    ref2va_subtrees: dict[str, dict[str, int]] = defaultdict(lambda: {"files": 0, "bytes": 0})

    for item in files:
        path = str(item["path"])
        size = int(item["size"])
        top = path.split("/", 1)[0] if "/" in path else "(root)"
        top_level[top]["files"] += 1
        top_level[top]["bytes"] += size

        if path.startswith("Ref2VA/"):
            remainder = path[len("Ref2VA/"):]
            subtree = remainder.split("/", 1)[0] if "/" in remainder else "(root)"
            ref2va_subtrees[subtree]["files"] += 1
            ref2va_subtrees[subtree]["bytes"] += size

    largest_files = sorted(files, key=lambda item: int(item["size"]), reverse=True)[:20]
    required_sglang_scope = [
        item for item in files
        if str(item["path"]) == "model_index.json"
        or str(item["path"]).startswith("Ref2VA/")
    ]

    return {
        "repository": repo_id,
        "revision": info.sha,
        "total": {
            "files": len(files),
            "bytes": sum(int(item["size"]) for item in files),
        },
        "official_sglang_ref2va_scope": {
            "patterns": ["model_index.json", "Ref2VA/**"],
            "files": len(required_sglang_scope),
            "bytes": sum(int(item["size"]) for item in required_sglang_scope),
        },
        "top_level": dict(sorted(top_level.items())),
        "ref2va_subtrees": dict(sorted(ref2va_subtrees.items())),
        "largest_files": largest_files,
    }


@app.local_entrypoint()
def main() -> None:
    import json

    print(json.dumps(audit_h3_manifest.remote(), indent=2))
