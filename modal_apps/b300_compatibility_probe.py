"""Short, isolated compatibility probe for Modal's single B300 GPU.

This deliberately does not mount or load MiniMax-H3. It only verifies that
the exact SGLang container image used by ClikB can see and use a B300.
"""

import json
import re
import subprocess

import modal


app = modal.App("clikb-h3-b300-compatibility-probe")

probe_image = (
    modal.Image.from_registry("lmsysorg/sglang:dev")
    .run_commands('cd /sgl-workspace/sglang && pip install -e "python[diffusion]"')
    .run_commands(
        "apt-get update",
        "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends cuda-toolkit-13-1",
        "ln -sfn /usr/local/cuda-13.1 /usr/local/cuda",
        "rm -rf /var/lib/apt/lists/*",
        "/usr/local/cuda-13.1/bin/nvcc --version",
    )
    .env({
        "PYTHONUNBUFFERED": "1",
        "CUDA_HOME": "/usr/local/cuda-13.1",
    })
)


@app.function(
    image=probe_image,
    gpu="B300",
    cpu=1,
    memory=2048,
    timeout=5 * 60,
    min_containers=0,
    max_containers=1,
    scaledown_window=2,
)
def inspect_b300() -> dict[str, object]:
    import torch

    smi = subprocess.run(
        ["nvidia-smi", "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    nvcc = subprocess.run(
        ["/usr/local/cuda-13.1/bin/nvcc", "--version"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()

    import sglang  # noqa: F401

    properties = torch.cuda.get_device_properties(0)
    torch_cuda_version = str(torch.version.cuda or "")
    toolkit_match = re.search(r"release\s+(\d+)\.(\d+)", nvcc)
    toolkit_version = (
        f"{toolkit_match.group(1)}.{toolkit_match.group(2)}"
        if toolkit_match
        else ""
    )
    toolkit_parts = (
        (int(toolkit_match.group(1)), int(toolkit_match.group(2)))
        if toolkit_match
        else (0, 0)
    )
    meets_modal_cuda_requirement = toolkit_parts >= (13, 1)
    result: dict[str, object] = {
        "basic_gpu_access": bool(torch.cuda.is_available()),
        "meets_modal_cuda_13_1_requirement": meets_modal_cuda_requirement,
        "safe_for_full_h3_test": bool(torch.cuda.is_available() and meets_modal_cuda_requirement),
        "nvidia_smi": smi,
        "nvcc": nvcc,
        "cuda_toolkit_version": toolkit_version,
        "torch_version": str(torch.__version__),
        "torch_cuda_version": torch_cuda_version,
        "device_name": str(properties.name),
        "compute_capability": f"{properties.major}.{properties.minor}",
        "total_memory_gib": round(properties.total_memory / (1024 ** 3), 2),
        "sglang_import": "ok",
    }
    print(json.dumps(result, indent=2, sort_keys=True), flush=True)
    return result


@app.local_entrypoint()
def main() -> None:
    result = inspect_b300.remote()
    print(json.dumps(result, indent=2, sort_keys=True))
