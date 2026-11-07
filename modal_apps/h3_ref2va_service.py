import json
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

import modal


APP_NAME = "clikb-h3-ref2va"
VOLUME_NAME = "clikb-minimax-h3-ref2va"
STATE_DICT_NAME = "clikb-h3-ref2va-state"
MODEL_ROOT = Path("/models/MiniMax-H3")
SGLANG_PORT = 30011
STARTUP_TIMEOUT_SECONDS = 30 * 60

app = modal.App(APP_NAME)
model_volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=False)
gpu_state = modal.Dict.from_name(STATE_DICT_NAME, create_if_missing=True)

control_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi==0.116.1"
)

# SGLang's official development image contains its CUDA/PyTorch kernel stack.
# MiniMax-H3 support currently requires the diffusion extras from that source tree.
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


def _serve_command() -> list[str]:
    return [
        "sglang",
        "serve",
        "--model-path",
        str(MODEL_ROOT),
        "--model-variant",
        "ref2va",
        "--num-gpus",
        "4",
        "--tp-size",
        "2",
        "--ulysses-degree",
        "2",
        "--encoder-parallel",
        "auto",
        "--performance-mode",
        "speed",
        "--host",
        "0.0.0.0",
        "--port",
        str(SGLANG_PORT),
    ]


def _read_json(url: str, timeout: float = 5.0) -> object:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        payload = response.read()
    return json.loads(payload) if payload else {}


def _wait_until_ready(process: subprocess.Popen[bytes]) -> tuple[float, str]:
    started_at = time.monotonic()
    health_urls = (
        f"http://127.0.0.1:{SGLANG_PORT}/health",
        f"http://127.0.0.1:{SGLANG_PORT}/v1/models",
    )

    while time.monotonic() - started_at < STARTUP_TIMEOUT_SECONDS:
        return_code = process.poll()
        if return_code is not None:
            raise RuntimeError(f"SGLang exited during startup with code {return_code}")

        for url in health_urls:
            try:
                _read_json(url)
                return time.monotonic() - started_at, url
            except (OSError, ValueError, urllib.error.HTTPError):
                pass
        time.sleep(5)

    raise TimeoutError(
        f"SGLang did not become healthy within {STARTUP_TIMEOUT_SECONDS} seconds"
    )


def _tail(path: Path, max_bytes: int = 24_000) -> str:
    if not path.is_file():
        return ""
    with path.open("rb") as handle:
        handle.seek(0, 2)
        size = handle.tell()
        handle.seek(max(0, size - max_bytes))
        return handle.read().decode("utf-8", errors="replace")


def _default_gpu_state() -> dict[str, object]:
    return {
        "status": "off",
        "message": "GPU is off",
        "stage": "off",
        "stage_index": 0,
        "stage_total": 4,
        "gpu_count": 0,
        "active_containers": 0,
        "started_at": None,
        "ready_at": None,
        "stopped_at": None,
        "shutdown_requested_at": None,
        "updated_at": time.time(),
    }


def _get_gpu_state() -> dict[str, object]:
    state = gpu_state.get("state")
    return dict(state) if isinstance(state, dict) else _default_gpu_state()


def _set_gpu_state(**updates: object) -> dict[str, object]:
    state = _get_gpu_state()
    state.update(updates)
    state["updated_at"] = time.time()
    gpu_state["state"] = state
    return state


def _current_runner_count() -> int | None:
    try:
        return int(serve.get_current_stats().num_total_runners)
    except Exception:
        # Never claim that paid compute is gone when Modal's runner status
        # cannot be verified. The next status poll will try again.
        return None


def _state_response(active_containers: int | None = None) -> dict[str, object]:
    state = _get_gpu_state()
    if active_containers is None:
        active_containers = _current_runner_count()
    if active_containers is not None:
        state["active_containers"] = active_containers
    ready_at = state.get("ready_at")
    state["uptime_seconds"] = (
        max(0, int(time.time() - float(ready_at))) if ready_at else 0
    )
    return state


@app.function(image=sglang_image, cpu=2, memory=4096, timeout=10 * 60)
def environment_check() -> dict[str, object]:
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


@app.function(
    image=sglang_image,
    gpu="H100:4",
    cpu=16,
    memory=131072,
    timeout=45 * 60,
    volumes={"/models": model_volume},
)
def load_test() -> dict[str, object]:
    """Load Ref2VA, wait for its HTTP server, report health, then release GPUs."""
    required_paths = [
        MODEL_ROOT / "model_index.json",
        MODEL_ROOT / "Ref2VA" / "model_index.json",
    ]
    missing_paths = [str(path) for path in required_paths if not path.is_file()]
    if missing_paths:
        raise RuntimeError(f"Model Volume is incomplete; missing: {missing_paths}")

    gpu_info = subprocess.run(
        [
            "nvidia-smi",
            "--query-gpu=index,name,memory.total",
            "--format=csv,noheader",
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()

    log_path = Path("/tmp/sglang-ref2va-load-test.log")
    command = _serve_command()
    with log_path.open("wb") as log_handle:
        process = subprocess.Popen(command, stdout=log_handle, stderr=subprocess.STDOUT)
        try:
            startup_seconds, health_url = _wait_until_ready(process)
            models = _read_json(f"http://127.0.0.1:{SGLANG_PORT}/v1/models")
            return {
                "status": "ready",
                "startup_seconds": round(startup_seconds, 2),
                "health_url": health_url,
                "models": models,
                "gpus": gpu_info.splitlines(),
                "command": command,
            }
        except Exception as exc:
            raise RuntimeError(f"{exc}\n--- SGLang log tail ---\n{_tail(log_path)}") from exc
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=10)


@app.function(
    image=sglang_image,
    gpu="H100:4",
    cpu=16,
    memory=131072,
    timeout=24 * 60 * 60,
    min_containers=0,
    max_containers=1,
    scaledown_window=5 * 60,
    volumes={"/models": model_volume},
)
@modal.web_server(
    port=SGLANG_PORT,
    startup_timeout=STARTUP_TIMEOUT_SECONDS,
    requires_proxy_auth=True,
)
def serve() -> None:
    """Proxy-authenticated Ref2VA server controlled by the CPU control API."""
    gpu_lines = subprocess.run(
        ["nvidia-smi", "--query-gpu=index", "--format=csv,noheader"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    detected_gpu_count = len([line for line in gpu_lines if line.strip()])
    if detected_gpu_count != 4:
        raise RuntimeError(f"Expected 4 H100 GPUs, detected {detected_gpu_count}")

    _set_gpu_state(
        status="starting",
        message=f"{detected_gpu_count} of 4 GPUs connected",
        stage="gpus_connected",
        stage_index=2,
        stage_total=4,
        gpu_count=detected_gpu_count,
        active_containers=1,
        error=None,
    )
    log_path = Path("/tmp/sglang-ref2va-server.log")
    log_handle = log_path.open("ab", buffering=0)
    process = subprocess.Popen(
        _serve_command(),
        stdout=log_handle,
        stderr=subprocess.STDOUT,
    )
    _set_gpu_state(
        status="starting",
        message="Loading video model",
        stage="loading_model",
        stage_index=3,
        stage_total=4,
        gpu_count=detected_gpu_count,
        active_containers=1,
    )
    try:
        startup_seconds, _ = _wait_until_ready(process)
        _set_gpu_state(
            status="ready",
            message="GPU ready · 4× H100",
            stage="ready",
            stage_index=4,
            stage_total=4,
            gpu_count=detected_gpu_count,
            active_containers=1,
            ready_at=time.time(),
            startup_seconds=round(startup_seconds, 2),
        )
    except Exception as exc:
        if process.poll() is None:
            process.terminate()
        _set_gpu_state(
            status="error",
            message="MiniMax-H3 failed to start",
            stage="error",
            error=f"{exc}\n{_tail(log_path)}",
        )
        raise


@app.function(image=control_image, cpu=0.5, memory=512, timeout=60)
@modal.asgi_app(requires_proxy_auth=True)
def control():
    from fastapi import FastAPI

    api = FastAPI(title="ClikB MiniMax-H3 GPU Control", docs_url=None, redoc_url=None)

    @api.post("/start")
    async def start_gpu() -> dict[str, object]:
        current = _get_gpu_state()
        active_containers = _current_runner_count()
        serve.update_autoscaler(
            min_containers=1,
            max_containers=1,
            scaledown_window=5 * 60,
        )
        if current.get("status") == "ready" and active_containers and active_containers > 0:
            return _state_response(active_containers)
        state = _set_gpu_state(
            status="starting",
            message="Requesting 4 GPUs",
            stage="requesting_gpus",
            stage_index=1,
            stage_total=4,
            gpu_count=0,
            active_containers=active_containers or 0,
            started_at=time.time(),
            ready_at=None,
            stopped_at=None,
            shutdown_requested_at=None,
            error=None,
        )
        state["uptime_seconds"] = 0
        return state

    @api.get("/status")
    async def gpu_status() -> dict[str, object]:
        state = _get_gpu_state()
        active_containers = _current_runner_count()
        current_status = state.get("status")

        if current_status == "stopping":
            if active_containers == 0:
                _set_gpu_state(
                    status="off",
                    message="GPU stopped",
                    stage="off",
                    stage_index=0,
                    stage_total=4,
                    gpu_count=0,
                    active_containers=0,
                    ready_at=None,
                    stopped_at=time.time(),
                    shutdown_requested_at=None,
                    error=None,
                )
                return _state_response(0)

            shutdown_requested_at = state.get("shutdown_requested_at")
            shutdown_slow = bool(
                shutdown_requested_at
                and time.time() - float(shutdown_requested_at) > 90
            )
            _set_gpu_state(
                message=(
                    "GPU shutdown is taking longer than expected"
                    if shutdown_slow
                    else "Releasing 4 GPUs"
                ),
                stage="releasing_gpus",
                active_containers=active_containers,
                error=(
                    "Modal still reports an active GPU container. Shutdown checks will continue."
                    if shutdown_slow
                    else None
                ),
            )
            return _state_response(active_containers)

        started_at = state.get("started_at")
        if (
            current_status == "starting"
            and started_at
            and time.time() - float(started_at) > STARTUP_TIMEOUT_SECONDS + 60
        ):
            _set_gpu_state(
                status="error",
                message="GPU startup timed out",
                stage="error",
                error="MiniMax-H3 did not become ready before the startup deadline.",
            )
        return _state_response(active_containers)

    @api.post("/stop")
    async def stop_gpu() -> dict[str, object]:
        previous = _get_gpu_state()
        _set_gpu_state(
            status="stopping",
            message="Releasing 4 GPUs",
            stage="releasing_gpus",
            stage_index=1,
            stage_total=2,
            shutdown_requested_at=time.time(),
            error=None,
        )
        try:
            serve.update_autoscaler(
                min_containers=0,
                max_containers=1,
                scaledown_window=0,
            )
        except Exception:
            previous["message"] = "Could not request GPU shutdown"
            previous["error"] = "Modal rejected the scale-to-zero request."
            previous["updated_at"] = time.time()
            gpu_state["state"] = previous
            raise

        active_containers = _current_runner_count()
        if active_containers == 0:
            _set_gpu_state(
                status="off",
                message="GPU stopped",
                stage="off",
                stage_index=0,
                stage_total=4,
                gpu_count=0,
                active_containers=0,
                ready_at=None,
                stopped_at=time.time(),
                shutdown_requested_at=None,
                error=None,
            )
            return _state_response(0)
        return _state_response(active_containers)

    return api


@app.function(image=control_image, cpu=0.25, memory=256, timeout=30)
def reset_gpu_state() -> dict[str, object]:
    serve.update_autoscaler(min_containers=0, max_containers=1, scaledown_window=0)
    state = _default_gpu_state()
    gpu_state["state"] = state
    return state


@app.local_entrypoint()
def main(check: str = "environment") -> None:
    if check == "environment":
        print(environment_check.remote())
    elif check == "load":
        print(load_test.remote())
    else:
        raise ValueError("check must be 'environment' or 'load'")
