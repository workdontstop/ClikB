"""Isolated per-user LTX-2.5 first-frame I2V sessions on one Modal B300.

This application intentionally shares no app name, Dict, Volume, autoscaler, or
control endpoint with the existing MiniMax-H3 B200/B300 deployments.  Its HTTP
contract mirrors the H3 control service so ClikB can integrate it later without
changing the existing provider path during the benchmark phase.
"""

import json
import math
import mimetypes
import os
import re
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import deque
from pathlib import Path

import modal


APP_NAME = "clikb-ltx25-i2v-b300"
STATE_NAME = "clikb-ltx25-i2v-b300-user-sessions"
MODEL_VOLUME_NAME = "clikb-ltx25-models"
OUTPUT_VOLUME_NAME = "clikb-ltx25-test-outputs"
MODEL_ID = "Lightricks/LTX-2.5-Diffusers"
VLLM_OMNI_IMAGE = (
    "vllm/vllm-omni:nightly-adf6d0c1ea33f74cf5e8ae7860cee8c9547c6bac"
)
PIPELINE_CLASS = "LTX2DistilledTwoStagePipeline"
GPU_TYPE = "B300"
GPU_LABEL = "B300"
SERVER_PORT = 30012
STARTUP_TIMEOUT = 25 * 60
IDLE_TIMEOUT = 5 * 60
MAX_IMAGE_BYTES = 50 * 1024 * 1024
LANDSCAPE_MODEL_SIZE = (1920, 1088)
LANDSCAPE_DELIVERY_SIZE = (1920, 1080)
PORTRAIT_MODEL_SIZE = (1088, 1920)
PORTRAIT_DELIVERY_SIZE = (1080, 1920)
SQUARE_MODEL_SIZE = (1088, 1088)
SQUARE_DELIVERY_SIZE = (1080, 1080)
DEFAULT_WIDTH, DEFAULT_HEIGHT = LANDSCAPE_MODEL_SIZE
DEFAULT_FPS = 24
DEFAULT_SECONDS = 5
DEFAULT_STEPS = 8

app = modal.App(APP_NAME)
model_volume = modal.Volume.from_name(MODEL_VOLUME_NAME, create_if_missing=True)
output_volume = modal.Volume.from_name(OUTPUT_VOLUME_NAME, create_if_missing=True)
states = modal.Dict.from_name(STATE_NAME, create_if_missing=True)
hf_secret = modal.Secret.from_name("huggingface-secret")

deployment_env = {
    "HF_HOME": "/models/huggingface",
    "HF_HUB_CACHE": "/models/huggingface/hub",
    "HUGGINGFACE_HUB_CACHE": "/models/huggingface/hub",
    "VLLM_CACHE_ROOT": "/models/vllm-cache/ltx25-b300-adf6d0c1",
    "TORCHINDUCTOR_CACHE_DIR": "/models/vllm-cache/ltx25-b300-adf6d0c1/inductor",
    "TRITON_CACHE_DIR": "/models/vllm-cache/ltx25-b300-adf6d0c1/triton",
    "PYTHONUNBUFFERED": "1",
    "TOKENIZERS_PARALLELISM": "false",
}

control_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi==0.116.1"
)

download_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "huggingface_hub==0.36.0"
)

gpu_image = (
    modal.Image.from_registry(VLLM_OMNI_IMAGE)
    .apt_install("ffmpeg")
    .env(deployment_env)
)


def _server_command() -> list[str]:
    return [
        "vllm",
        "serve",
        MODEL_ID,
        "--omni",
        "--model-class-name",
        PIPELINE_CLASS,
        "--host",
        "127.0.0.1",
        "--port",
        str(SERVER_PORT),
        "--stage-init-timeout",
        str(STARTUP_TIMEOUT),
        "--init-timeout",
        str(STARTUP_TIMEOUT),
    ]


def _default() -> dict[str, object]:
    return {
        "status": "off",
        "message": "GPU is off",
        "stage": "off",
        "stage_index": 0,
        "stage_total": 4,
        "gpu_count": 0,
        "active_containers": 0,
        "active_jobs": 0,
        "started_at": None,
        "ready_at": None,
        "last_activity_at": None,
        "stopped_at": None,
        "shutdown_requested_at": None,
        "paid_deadline_at": None,
        "paid_remaining_seconds": None,
        "paid_balance_pending": False,
        "billing_started_at": None,
        "startup_call_id": None,
        "startup_token": None,
        "session_id": None,
        "accepting_jobs": False,
        "generation_call_ids": [],
        "generation_queue": [],
        "active_job_id": None,
        "error": None,
    }


def _paid_remaining_seconds(value: dict[str, object], now: float | None = None) -> int:
    deadline = value.get("paid_deadline_at")
    if deadline:
        return max(0, int(math.ceil(float(deadline) - (now or time.time()))))
    return max(0, int(value.get("paid_remaining_seconds") or 0))


def _reported_paid_remaining(value: dict[str, object]) -> int | None:
    # The explicit flag is present on all new sessions. The deadline fallback
    # safely carries an already-running session across this deployment.
    pending = bool(value.get("paid_balance_pending")) or bool(
        value.get("status") in {"starting", "ready"} and value.get("paid_deadline_at")
    )
    return _paid_remaining_seconds(value) if pending else None


def _key(user_key: str) -> str:
    return f"user:{user_key}"


def _job_key(user_key: str, job_id: str) -> str:
    return f"job:{user_key}:{job_id}"


def _get(user_key: str) -> dict[str, object]:
    value = states.get(_key(user_key))
    return dict(value) if isinstance(value, dict) else _default()


def _set(user_key: str, **updates: object) -> dict[str, object]:
    value = _get(user_key)
    value.update(updates)
    value["updated_at"] = time.time()
    states[_key(user_key)] = value
    return value


def _get_job(user_key: str, job_id: str) -> dict[str, object] | None:
    value = states.get(_job_key(user_key, job_id))
    return dict(value) if isinstance(value, dict) else None


def _set_job(user_key: str, job_id: str, **updates: object) -> dict[str, object]:
    value = _get_job(user_key, job_id) or {
        "jobId": job_id,
        "status": "queued",
        "phase": "queued",
        "progress": 1,
        "message": "VIDEO QUEUED",
        "queue_position": 1,
        "created_at": time.time(),
    }
    value.update(updates)
    value["updated_at"] = time.time()
    states[_job_key(user_key, job_id)] = value
    return value


def _queued_job_ids(user_key: str) -> list[str]:
    queue = _get(user_key).get("generation_queue")
    return [str(item) for item in queue] if isinstance(queue, list) else []


def _refresh_queue_positions(user_key: str, queue: list[str]) -> None:
    for position, job_id in enumerate(queue, start=1):
        if _get_job(user_key, job_id):
            _set_job(
                user_key,
                job_id,
                status="queued",
                phase="queued",
                progress=1,
                queue_position=position,
                message=(
                    "VIDEO QUEUED · NEXT"
                    if position == 1
                    else f"VIDEO QUEUED · {position - 1} AHEAD"
                ),
            )


def _validate_user_key(value: object) -> str:
    user_key = str(value or "").strip()
    if (
        not user_key
        or len(user_key) > 96
        or not all(character.isalnum() or character in "-_" for character in user_key)
    ):
        raise ValueError("Invalid user session key")
    return user_key


def _log(event: str, user_key: str, **details: object) -> None:
    print(
        json.dumps(
            {
                "component": "clikb_ltx25_lifecycle",
                "event": event,
                "session": user_key[:12],
                "timestamp": round(time.time(), 3),
                **details,
            },
            default=str,
            sort_keys=True,
        ),
        flush=True,
    )


def _json_request(url: str, timeout: int = 30) -> dict[str, object]:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
    parsed = json.loads(raw) if raw else {}
    if not isinstance(parsed, dict):
        raise RuntimeError("Invalid response from LTX-2.5")
    return parsed


def _wait_ready(process: subprocess.Popen[str]) -> float:
    started = time.monotonic()
    while time.monotonic() - started < STARTUP_TIMEOUT:
        if process.poll() is not None:
            raise RuntimeError(f"vLLM-Omni exited during startup ({process.returncode})")
        try:
            _json_request(f"http://127.0.0.1:{SERVER_PORT}/v1/models", timeout=5)
            return time.monotonic() - started
        except Exception:
            time.sleep(5)
    raise TimeoutError("LTX-2.5 startup timed out")


def _stream_process_output(process: subprocess.Popen[str], tail: deque[str]) -> None:
    if process.stdout is None:
        return
    for raw_line in process.stdout:
        line = raw_line.rstrip()
        if not line:
            continue
        tail.append(line)
        print(f"[vLLM-Omni] {line}", flush=True)


def _latest_denoise_progress(lines: deque[str]) -> tuple[int, int, int] | None:
    patterns = (
        re.compile(r"(?:denois\w*|sampling).*?(\d+)%.*?(\d+)\s*/\s*(\d+)", re.I),
        re.compile(r"(\d+)%.*?\|\s*(\d+)\s*/\s*(\d+)", re.I),
    )
    for line in reversed(lines):
        for pattern in patterns:
            match = pattern.search(line)
            if match:
                return int(match.group(1)), int(match.group(2)), int(match.group(3))
    return None


def _download_image(url: str, destination: Path) -> tuple[Path, str]:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("The LTX first frame must use HTTPS")
    total = 0
    request = urllib.request.Request(url, headers={"User-Agent": "ClikB-LTX25/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response, destination.open("wb") as output:
        content_type = str(response.headers.get("Content-Type") or "image/png").split(";", 1)[0]
        if int(response.headers.get("Content-Length") or 0) > MAX_IMAGE_BYTES:
            raise ValueError("The LTX first frame is too large")
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_IMAGE_BYTES:
                raise ValueError("The LTX first frame is too large")
            output.write(chunk)
    return destination, content_type


def _delivery_size(width: int, height: int) -> tuple[int, int]:
    if (width, height) == LANDSCAPE_MODEL_SIZE:
        return LANDSCAPE_DELIVERY_SIZE
    if (width, height) == PORTRAIT_MODEL_SIZE:
        return PORTRAIT_DELIVERY_SIZE
    if (width, height) == SQUARE_MODEL_SIZE:
        return SQUARE_DELIVERY_SIZE
    raise ValueError(
        "LTX-2.5 supports 1920x1088 landscape, 1088x1920 portrait, or 1088x1088 square"
    )


def _crop_to_1080p(
    video_bytes: bytes,
    job_dir: Path,
    width: int,
    height: int,
    include_audio: bool = True,
) -> tuple[bytes, float]:
    """Centre-crop the alignment pixels and optionally retain generated audio."""
    delivery_width, delivery_height = _delivery_size(width, height)
    crop_x = (width - delivery_width) // 2
    crop_y = (height - delivery_height) // 2
    source_path = job_dir / "model-output.mp4"
    delivery_path = job_dir / "delivery-1080p.mp4"
    source_path.write_bytes(video_bytes)
    started = time.monotonic()
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source_path),
        "-map",
        "0:v:0",
    ]
    if include_audio:
        command.extend(["-map", "0:a?"])
    command.extend(
        [
            "-vf",
            f"crop={delivery_width}:{delivery_height}:{crop_x}:{crop_y}",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "18",
        ]
    )
    command.extend(["-c:a", "copy"] if include_audio else ["-an"])
    command.extend(
        [
            "-movflags",
            "+faststart",
            str(delivery_path),
        ]
    )
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )
    if completed.returncode != 0 or not delivery_path.is_file():
        detail = (completed.stderr or completed.stdout or "unknown ffmpeg error")[-4000:]
        raise RuntimeError(f"1080p crop failed: {detail}")
    return delivery_path.read_bytes(), round(time.monotonic() - started, 3)


def _multipart_body(
    fields: dict[str, object],
    image_path: Path,
    image_mime: str,
) -> tuple[bytes, str]:
    boundary = f"----ClikBLTX25{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                str(value).encode(),
                b"\r\n",
            ]
        )
    chunks.extend(
        [
            f"--{boundary}\r\n".encode(),
            (
                'Content-Disposition: form-data; name="input_reference"; '
                f'filename="{image_path.name}"\r\n'
            ).encode(),
            f"Content-Type: {image_mime}\r\n\r\n".encode(),
            image_path.read_bytes(),
            b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
    )
    return b"".join(chunks), boundary


def _call_is_active(call_id: object) -> bool:
    if not call_id:
        return False
    try:
        modal.FunctionCall.from_id(str(call_id)).get(timeout=0)
        return False
    except TimeoutError:
        return True
    except Exception:
        return False


def _generation_call_ids(value: dict[str, object]) -> list[str]:
    call_ids = value.get("generation_call_ids")
    return [str(item) for item in call_ids] if isinstance(call_ids, list) else []


def _session_is_active(user_key: str, session_id: object) -> bool:
    """True only while work still belongs to the currently powered GPU session."""
    value = _get(user_key)
    return bool(
        session_id
        and value.get("session_id") == session_id
        and value.get("accepting_jobs")
        and value.get("status") in {"starting", "ready"}
    )


def _job_is_active(user_key: str, job_id: str, session_id: object) -> bool:
    job = _get_job(user_key, job_id) or {}
    return bool(
        _session_is_active(user_key, session_id)
        and job.get("session_id") == session_id
        and job.get("status") != "cancelled"
    )


def _response(user_key: str, runners: int | None = None) -> dict[str, object]:
    value = _get(user_key)
    value["gpu_label"] = GPU_LABEL
    value["model_label"] = "LTX-2.5 I2V"
    if runners is not None:
        value["active_containers"] = runners
    origin = value.get("ready_at") or value.get("started_at")
    value["uptime_seconds"] = max(0, int(time.time() - float(origin))) if origin else 0
    last = value.get("last_activity_at")
    value["idle_seconds_remaining"] = (
        max(0, IDLE_TIMEOUT - int(time.time() - float(last)))
        if value.get("status") == "ready" and not value.get("active_jobs") and last
        else 0
    )
    value["idle_timeout_seconds"] = IDLE_TIMEOUT
    value["paid_remaining_seconds"] = _reported_paid_remaining(value)
    value["billing_active"] = bool(
        value.get("paid_deadline_at")
        and value.get("status") in {"starting", "ready"}
    )
    return value


@app.function(
    image=download_image,
    cpu=4,
    memory=8192,
    timeout=6 * 60 * 60,
    volumes={"/models": model_volume},
    secrets=[hf_secret],
)
def cache_model() -> dict[str, object]:
    """Download the gated checkpoint on CPU so B300 time is not spent downloading."""
    from huggingface_hub import snapshot_download

    started = time.monotonic()
    path = snapshot_download(MODEL_ID, cache_dir="/models/huggingface/hub")
    model_volume.commit()
    result = {
        "status": "cached",
        "model": MODEL_ID,
        "path": path,
        "seconds": round(time.monotonic() - started, 2),
    }
    print(json.dumps(result, sort_keys=True), flush=True)
    return result


@app.function(image=gpu_image, cpu=2, memory=4096, timeout=15 * 60)
def check_runtime() -> dict[str, object]:
    """Verify the pinned image exposes the requested pipeline without renting a GPU."""
    import vllm
    import vllm_omni
    from vllm_omni.diffusion import registry

    vllm_version = str(getattr(vllm, "__version__", "unknown"))
    omni_version = str(getattr(vllm_omni, "__version__", "unknown"))
    registered_models = getattr(registry, "_DIFFUSION_MODELS", {})
    if PIPELINE_CLASS not in registered_models:
        available_ltx = sorted(
            name for name in registered_models if name.startswith("LTX")
        )
        raise RuntimeError(
            f"{PIPELINE_CLASS} is missing from {VLLM_OMNI_IMAGE}; "
            f"available LTX classes: {available_ltx}"
        )
    result = {
        "status": "compatible",
        "image": VLLM_OMNI_IMAGE,
        "pipeline": PIPELINE_CLASS,
        "vllm_version": vllm_version,
        "vllm_omni_version": omni_version,
    }
    print(json.dumps(result, sort_keys=True), flush=True)
    return result


@app.cls(
    image=gpu_image,
    gpu=GPU_TYPE,
    cpu=8,
    memory=65536,
    timeout=24 * 60 * 60,
    min_containers=0,
    max_containers=1,
    scaledown_window=IDLE_TIMEOUT,
    retries=0,
    startup_timeout=STARTUP_TIMEOUT + 2 * 60,
    volumes={"/models": model_volume, "/outputs": output_volume},
    secrets=[hf_secret],
)
@modal.concurrent(max_inputs=1)
class LTX25Session:
    user_key: str = modal.parameter()

    @modal.enter()
    def boot(self) -> None:
        current = _get(self.user_key)
        self.session_id = str(current.get("session_id") or "")
        if not _session_is_active(self.user_key, self.session_id):
            _log("stale_container_boot_rejected", self.user_key, session_id=self.session_id)
            raise RuntimeError("GPU session was stopped before this container started")

        # Startup is not user-visible GPU time. The paid deadline begins only
        # after warmup verifies that vLLM is ready. This also prevents a late
        # container from resurrecting a stopped session with a zero balance.
        _set(
            self.user_key,
            message="Loading LTX-2.5 distilled I2V",
            stage="loading_model",
            stage_index=3,
            gpu_count=1,
            active_containers=1,
        )
        self.log_tail: deque[str] = deque(maxlen=100)
        _log("vllm_starting", self.user_key, command=_server_command())
        self.process = subprocess.Popen(
            _server_command(),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        self.log_thread = threading.Thread(
            target=_stream_process_output,
            args=(self.process, self.log_tail),
            daemon=True,
        )
        self.log_thread.start()
        try:
            startup_seconds = _wait_ready(self.process)
        except Exception as error:
            if not _session_is_active(self.user_key, self.session_id):
                _log(
                    "stale_startup_failure_ignored",
                    self.user_key,
                    session_id=self.session_id,
                    error=str(error)[:500],
                )
                raise
            diagnostic_tail = "\n".join(self.log_tail)[-12000:]
            failed_value = _get(self.user_key)
            paid_remaining = _paid_remaining_seconds(failed_value)
            _set(
                self.user_key,
                status="error",
                stage="error",
                message="LTX-2.5 failed to start",
                error=str(error)[:1000],
                startup_log_tail=diagnostic_tail,
                paid_deadline_at=None,
                paid_remaining_seconds=paid_remaining,
                gpu_count=0,
                active_containers=0,
            )
            _log(
                "vllm_startup_failed",
                self.user_key,
                error_type=type(error).__name__,
                error=str(error)[:1000],
                startup_log_tail=diagnostic_tail,
            )
            raise
        if not _session_is_active(self.user_key, self.session_id):
            _log("stale_container_ready_rejected", self.user_key, session_id=self.session_id)
            raise RuntimeError("GPU session was stopped during startup")
        _set(
            self.user_key,
            startup_seconds=round(startup_seconds, 2),
            message="Finalizing LTX-2.5 I2V",
            stage="finalizing",
            stage_index=4,
            error=None,
        )
        _log("vllm_ready", self.user_key, startup_seconds=round(startup_seconds, 2))

    @modal.exit()
    def shutdown(self) -> None:
        process = getattr(self, "process", None)
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                process.kill()
        log_thread = getattr(self, "log_thread", None)
        if log_thread is not None:
            log_thread.join(timeout=2)

    @modal.method()
    def warmup(self, startup_token: str) -> dict[str, object]:
        current = _get(self.user_key)
        if (
            current.get("status") != "starting"
            or current.get("startup_token") != startup_token
            or current.get("session_id") != self.session_id
            or not current.get("accepting_jobs")
        ):
            _log("stale_warmup_ignored", self.user_key)
            return current
        now = time.time()
        paid_remaining = _paid_remaining_seconds(current, now)
        value = _set(
            self.user_key,
            status="ready",
            message="GPU ready · LTX-2.5 · 1× B300",
            stage="ready",
            stage_index=4,
            gpu_count=1,
            active_containers=1,
            ready_at=now,
            last_activity_at=now,
            startup_token=None,
            paid_deadline_at=(now + paid_remaining) if paid_remaining > 0 else now,
            paid_remaining_seconds=paid_remaining,
            billing_started_at=now,
            error=None,
        )
        _log("warmup_completed", self.user_key)
        return value

    @modal.method()
    def generate(self, payload: dict[str, object]) -> dict[str, object]:
        job_id = str(payload.pop("job_id", "")).strip()
        session_id = str(payload.pop("session_id", "")).strip()
        if not job_id:
            raise ValueError("An LTX queue job ID is required")
        if not _job_is_active(self.user_key, job_id, session_id):
            return {"status": "cancelled", "jobId": job_id}

        queue = [item for item in _queued_job_ids(self.user_key) if item != job_id]
        _set(
            self.user_key,
            generation_queue=queue,
            active_jobs=len(queue) + 1,
            active_job_id=job_id,
            status="ready",
            last_activity_at=time.time(),
            message="Generating with LTX-2.5",
            error=None,
        )
        _refresh_queue_positions(self.user_key, queue)
        _set_job(
            self.user_key,
            job_id,
            status="running",
            phase="preparing",
            progress=3,
            queue_position=0,
            started_at=time.time(),
            message="PREPARING FIRST FRAME",
        )

        job_dir = Path(f"/tmp/ltx25-job-{job_id}")
        job_dir.mkdir(parents=True, exist_ok=True)
        try:
            if not _job_is_active(self.user_key, job_id, session_id):
                return {"status": "cancelled", "jobId": job_id}
            prompt = str(payload.get("prompt") or "").strip()
            if not prompt:
                raise ValueError("A video prompt is required")

            image_url = str(payload.get("image_url") or "").strip()
            references = payload.get("image_references")
            if not image_url and isinstance(references, list) and references:
                first = references[0]
                if isinstance(first, dict):
                    image_url = str(first.get("url") or "").strip()

            supplied_bytes = payload.pop("_benchmark_image_bytes", None)
            if isinstance(supplied_bytes, bytes):
                if len(supplied_bytes) > MAX_IMAGE_BYTES:
                    raise ValueError("The benchmark first frame is too large")
                image_path = job_dir / "first-frame.png"
                image_path.write_bytes(supplied_bytes)
                image_mime = str(payload.pop("_benchmark_image_mime", "image/png"))
            else:
                if not image_url:
                    raise ValueError("LTX-2.5 I2V requires one first-frame image")
                suffix = Path(urllib.parse.urlparse(image_url).path).suffix.lower()
                if not suffix or len(suffix) > 8:
                    suffix = mimetypes.guess_extension("image/png") or ".png"
                image_path, image_mime = _download_image(
                    image_url, job_dir / f"first-frame{suffix}"
                )

            width = int(payload.get("width") or DEFAULT_WIDTH)
            height = int(payload.get("height") or DEFAULT_HEIGHT)
            if width % 64 or height % 64:
                raise ValueError("LTX two-stage final width and height must be divisible by 64")
            delivery_width, delivery_height = _delivery_size(width, height)
            seconds = max(1, min(15, int(payload.get("duration") or DEFAULT_SECONDS)))
            requested_frames = seconds * DEFAULT_FPS
            num_frames = max(9, round((requested_frames - 1) / 8) * 8 + 1)
            seed = int(payload.get("seed") or 3101)

            fields: dict[str, object] = {
                "prompt": prompt,
                "width": width,
                "height": height,
                "num_frames": num_frames,
                "fps": DEFAULT_FPS,
                "num_inference_steps": DEFAULT_STEPS,
                "seed": seed,
            }
            request_body, boundary = _multipart_body(fields, image_path, image_mime)
            request = urllib.request.Request(
                f"http://127.0.0.1:{SERVER_PORT}/v1/videos/sync",
                data=request_body,
                method="POST",
                headers={
                    "Content-Type": f"multipart/form-data; boundary={boundary}",
                    "Accept": "video/mp4",
                },
            )

            _set_job(
                self.user_key,
                job_id,
                phase="submitting",
                progress=8,
                message="SENDING FIRST FRAME TO LTX-2.5",
                width=width,
                height=height,
                delivery_width=delivery_width,
                delivery_height=delivery_height,
                num_frames=num_frames,
                num_inference_steps=DEFAULT_STEPS,
                seed=seed,
            )

            result_box: dict[str, object] = {}

            def run_request() -> None:
                try:
                    with urllib.request.urlopen(request, timeout=2 * 60 * 60) as response:
                        result_box["video"] = response.read()
                except urllib.error.HTTPError as error:
                    detail = error.read().decode("utf-8", errors="replace")[:4000]
                    result_box["error"] = RuntimeError(
                        f"LTX-2.5 returned HTTP {error.code}: {detail}"
                    )
                except Exception as error:
                    result_box["error"] = error

            generation_started = time.monotonic()
            generation_thread = threading.Thread(target=run_request, daemon=True)
            generation_thread.start()
            last_progress: tuple[int, int, int] | None = None
            _set_job(
                self.user_key,
                job_id,
                phase="denoising",
                progress=10,
                message=f"GENERATING VIDEO · 0/{DEFAULT_STEPS}",
            )
            while generation_thread.is_alive():
                if not _job_is_active(self.user_key, job_id, session_id):
                    raise RuntimeError("GPU generation cancelled by shutdown")
                progress = _latest_denoise_progress(self.log_tail)
                if progress and progress != last_progress:
                    percent, step, total = progress
                    _set_job(
                        self.user_key,
                        job_id,
                        phase="denoising",
                        progress=min(90, 10 + round(percent * 0.8)),
                        message=f"GENERATING VIDEO · {step}/{total}",
                        model_progress=percent,
                        model_step=step,
                        model_step_total=total,
                    )
                    last_progress = progress
                time.sleep(1)
            generation_thread.join(timeout=1)
            if result_box.get("error"):
                raise result_box["error"]  # type: ignore[misc]
            video_bytes = result_box.get("video")
            if not isinstance(video_bytes, bytes) or not video_bytes:
                raise RuntimeError("LTX-2.5 returned no video bytes")
            if not _job_is_active(self.user_key, job_id, session_id):
                return {"status": "cancelled", "jobId": job_id}

            generation_seconds = round(time.monotonic() - generation_started, 3)
            include_audio_value = payload.get("include_audio")
            include_audio = include_audio_value is not False
            _set_job(
                self.user_key,
                job_id,
                phase="finalizing",
                progress=94,
                message="FINALIZING VIDEO",
                generation_seconds=generation_seconds,
                include_audio=include_audio,
            )
            video_bytes, crop_seconds = _crop_to_1080p(
                video_bytes,
                job_dir,
                width,
                height,
                include_audio,
            )
            if not _job_is_active(self.user_key, job_id, session_id):
                return {"status": "cancelled", "jobId": job_id}

            upload_url = str(payload.get("upload_url") or "").strip()
            video_url = str(payload.get("video_url") or "").strip()
            result: dict[str, object]
            if upload_url:
                _set_job(
                    self.user_key,
                    job_id,
                    phase="uploading",
                    progress=97,
                    message="UPLOADING VIDEO TO S3",
                )
                upload = urllib.request.Request(
                    upload_url,
                    data=video_bytes,
                    method="PUT",
                    headers={
                        "Content-Type": "video/mp4",
                        "Cache-Control": "public, max-age=31536000, immutable",
                    },
                )
                with urllib.request.urlopen(upload, timeout=900) as response:
                    if response.status not in {200, 204}:
                        raise RuntimeError(f"S3 upload failed ({response.status})")
                if not _job_is_active(self.user_key, job_id, session_id):
                    return {"status": "cancelled", "jobId": job_id}
                result = {
                    "status": "succeeded",
                    "videoUrl": video_url,
                    "generation_seconds": generation_seconds,
                    "crop_seconds": crop_seconds,
                    "width": delivery_width,
                    "height": delivery_height,
                    "include_audio": include_audio,
                }
            else:
                output_key = f"{job_id}.mp4"
                Path("/outputs", output_key).write_bytes(video_bytes)
                output_volume.commit()
                result = {
                    "status": "succeeded",
                    "output_key": output_key,
                    "generation_seconds": generation_seconds,
                    "crop_seconds": crop_seconds,
                    "width": delivery_width,
                    "height": delivery_height,
                    "include_audio": include_audio,
                }

            if not _job_is_active(self.user_key, job_id, session_id):
                return {"status": "cancelled", "jobId": job_id}
            _set_job(
                self.user_key,
                job_id,
                status="succeeded",
                phase="completed",
                progress=100,
                message="VIDEO READY",
                videoUrl=result.get("videoUrl"),
                output_key=result.get("output_key"),
                generation_seconds=generation_seconds,
                crop_seconds=crop_seconds,
                width=delivery_width,
                height=delivery_height,
                include_audio=include_audio,
                completed_at=time.time(),
                error=None,
            )
            remaining_call_ids = [
                call_id
                for call_id in _generation_call_ids(_get(self.user_key))
                if call_id != str((_get_job(self.user_key, job_id) or {}).get("call_id") or "")
            ]
            current_value = _get(self.user_key)
            current_active_job_id = str(current_value.get("active_job_id") or "")
            _set(
                self.user_key,
                generation_call_ids=remaining_call_ids,
                active_jobs=(
                    len(_queued_job_ids(self.user_key))
                    + (1 if current_active_job_id and current_active_job_id != job_id else 0)
                ),
                active_job_id=(None if current_active_job_id == job_id else current_active_job_id),
                last_activity_at=time.time(),
                message="Video saved",
            )
            _log(
                "generation_completed",
                self.user_key,
                job_id=job_id,
                generation_seconds=generation_seconds,
                crop_seconds=crop_seconds,
                bytes=len(video_bytes),
            )
            return result
        except Exception as error:
            if (_get_job(self.user_key, job_id) or {}).get("status") == "cancelled":
                remaining_call_ids = [
                    call_id
                    for call_id in _generation_call_ids(_get(self.user_key))
                    if call_id
                    != str((_get_job(self.user_key, job_id) or {}).get("call_id") or "")
                ]
                _set(self.user_key, generation_call_ids=remaining_call_ids)
                return {"status": "cancelled", "jobId": job_id}
            current_call_id = str(
                (_get_job(self.user_key, job_id) or {}).get("call_id") or ""
            )
            remaining_call_ids = [
                call_id
                for call_id in _generation_call_ids(_get(self.user_key))
                if call_id != current_call_id
            ]
            remaining_queue = _queued_job_ids(self.user_key)
            _set_job(
                self.user_key,
                job_id,
                status="failed",
                phase="failed",
                progress=0,
                message="VIDEO GENERATION FAILED",
                completed_at=time.time(),
                error=str(error)[:1000],
            )
            _set(
                self.user_key,
                status="ready",
                stage="ready",
                active_jobs=len(remaining_queue),
                active_job_id=None,
                generation_call_ids=remaining_call_ids,
                generation_queue=remaining_queue,
                last_activity_at=time.time(),
                message="Video generation failed",
                error=str(error)[:1000],
            )
            _log(
                "generation_failed",
                self.user_key,
                job_id=job_id,
                error_type=type(error).__name__,
                error=str(error)[:1000],
            )
            raise


def _runners(user_key: str) -> int | None:
    try:
        return int(LTX25Session(user_key=user_key).get_current_stats().num_total_runners)
    except Exception:
        return None


def _disable_user_pool(user_key: str, reason: str) -> int | None:
    current = _get(user_key)
    paid_remaining = _paid_remaining_seconds(current)
    _set(
        user_key,
        status="stopping",
        message=reason,
        stage="releasing_gpus",
        shutdown_requested_at=time.time(),
        paid_deadline_at=None,
        paid_remaining_seconds=paid_remaining,
        paid_balance_pending=bool(current.get("paid_balance_pending")),
        error=None,
    )
    settings = LTX25Session(user_key=user_key).update_autoscaler(
        min_containers=0,
        max_containers=0,
        scaledown_window=2,
    )
    _log("pool_disabled", user_key, autoscaler_settings=settings, reason=reason)
    return _runners(user_key)


@app.function(
    image=control_image,
    cpu=0.25,
    memory=256,
    timeout=60,
    schedule=modal.Period(seconds=60),
)
def reap_idle_sessions() -> None:
    now = time.time()
    for stored_key, raw_value in states.items():
        if not isinstance(stored_key, str) or not stored_key.startswith("user:"):
            continue
        if not isinstance(raw_value, dict):
            continue
        user_key = stored_key.removeprefix("user:")
        if raw_value.get("status") != "ready":
            continue
        paid_deadline = raw_value.get("paid_deadline_at")
        if paid_deadline and now >= float(paid_deadline):
            _set(user_key, paid_remaining_seconds=0)
            if raw_value.get("active_jobs"):
                continue
            try:
                _disable_user_pool(user_key, "GPU time ended · releasing B300")
                _log("paid_time_release_requested", user_key)
            except Exception as error:
                _set(user_key, error=f"Paid-time shutdown failed: {str(error)[:500]}")
            continue
        if raw_value.get("active_jobs"):
            continue
        last_activity = raw_value.get("last_activity_at")
        if not last_activity or now - float(last_activity) < IDLE_TIMEOUT:
            continue
        try:
            _disable_user_pool(user_key, "Idle timeout · releasing B300")
            _log("idle_pool_release_requested", user_key)
        except Exception as error:
            _set(user_key, error=f"Idle shutdown failed: {str(error)[:500]}")


@app.function(
    image=control_image,
    cpu=0.5,
    memory=512,
    timeout=60,
    max_containers=1,
)
@modal.concurrent(max_inputs=1)
@modal.asgi_app(requires_proxy_auth=True)
def control():
    from fastapi import FastAPI, HTTPException, Query

    api = FastAPI(docs_url=None, redoc_url=None)

    @api.post("/start")
    def start(body: dict[str, object]) -> dict[str, object]:
        user_key = _validate_user_key(body.get("user_key"))
        current = _get(user_key)
        runners = _runners(user_key)
        if current.get("status") == "ready" and runners:
            return _response(user_key, runners)
        if current.get("status") == "starting" and current.get("startup_call_id"):
            return _response(user_key, runners)
        paid_seconds = max(0, int(body.get("paid_seconds") or 0))
        if paid_seconds <= 0:
            raise HTTPException(402, "Add GPU time before starting the GPU.")
        now = time.time()
        session_id = uuid.uuid4().hex
        _set(
            user_key,
            **{
                **_default(),
                "status": "starting",
                "message": "Waiting for 1× B300 capacity",
                "stage": "requesting_gpus",
                "stage_index": 1,
                "stage_total": 4,
                "started_at": now,
                "last_activity_at": now,
                "paid_deadline_at": None,
                "paid_remaining_seconds": paid_seconds,
                "paid_balance_pending": True,
                "billing_started_at": None,
                "session_id": session_id,
                "accepting_jobs": True,
            },
        )
        session = LTX25Session(user_key=user_key)
        settings = session.update_autoscaler(
            min_containers=0,
            max_containers=1,
            scaledown_window=IDLE_TIMEOUT,
        )
        startup_token = uuid.uuid4().hex
        _set(user_key, startup_token=startup_token)
        call = session.warmup.spawn(startup_token)
        _set(user_key, startup_call_id=call.object_id)
        _log(
            "startup_warmup_submitted",
            user_key,
            session_id=session_id,
            autoscaler_settings=settings,
        )
        return _response(user_key, runners)

    @api.get("/status")
    def status(user_key: str = Query(...)) -> dict[str, object]:
        user_key = _validate_user_key(user_key)
        value = _get(user_key)
        runners = _runners(user_key)
        if (
            value.get("status") == "ready"
            and _paid_remaining_seconds(value) <= 0
            and not value.get("active_jobs")
            and runners
        ):
            runners = _disable_user_pool(user_key, "GPU time ended · releasing B300")
            value = _get(user_key)
        if value.get("status") == "starting" and value.get("startup_call_id"):
            if not _call_is_active(value.get("startup_call_id")):
                try:
                    result = modal.FunctionCall.from_id(str(value["startup_call_id"])).get(timeout=0)
                    if isinstance(result, dict) and result.get("status") == "ready":
                        value = _set(user_key, **result)
                    elif _get(user_key).get("status") == "starting":
                        value = _set(
                            user_key,
                            status="error",
                            stage="error",
                            message="LTX startup ended before becoming ready",
                            error="Modal warmup returned without a ready worker",
                        )
                except Exception as error:
                    value = _set(
                        user_key,
                        status="error",
                        stage="error",
                        message="LTX startup failed",
                        error=str(error)[:1000],
                    )
        if value.get("status") == "ready" and runners == 0:
            paid_remaining = _paid_remaining_seconds(value)
            off_state = _default()
            off_state.update(
                message="GPU is off",
                stopped_at=time.time(),
                paid_remaining_seconds=paid_remaining,
                paid_balance_pending=bool(value.get("paid_balance_pending")),
                session_id=value.get("session_id"),
            )
            value = _set(user_key, **off_state)
        if value.get("status") == "stopping":
            active = any(_call_is_active(call_id) for call_id in _generation_call_ids(value))
            requested = value.get("shutdown_requested_at") or value.get("updated_at")
            stale = bool(
                runners is None
                and requested
                and time.time() - float(requested) >= 30
                and not active
            )
            if runners == 0 or stale:
                paid_remaining = _paid_remaining_seconds(value)
                off_state = _default()
                off_state.update(
                    message="GPU stopped",
                    stopped_at=time.time(),
                    paid_remaining_seconds=paid_remaining,
                    paid_balance_pending=bool(value.get("paid_balance_pending")),
                    session_id=value.get("session_id"),
                )
                value = _set(user_key, **off_state)
        return _response(user_key, runners)

    @api.post("/stop")
    def stop(body: dict[str, object]) -> dict[str, object]:
        user_key = _validate_user_key(body.get("user_key"))
        value = _get(user_key)
        if value.get("status") == "starting":
            return _response(
                user_key,
                _runners(user_key),
            ) | {"message": "GPU startup must finish before it can be stopped"}
        if value.get("status") == "off":
            return _response(user_key, 0)
        if value.get("status") == "stopping":
            return _response(user_key, _runners(user_key))

        # Freeze paid time before cancellation. From this point onward neither
        # startup nor generation work is allowed to mutate the live session.
        paid_remaining = _paid_remaining_seconds(value)
        session_id = str(value.get("session_id") or "")
        startup_call_id = str(value.get("startup_call_id") or "")
        call_ids = list(dict.fromkeys(_generation_call_ids(value)))
        active_job = _get_job(user_key, str(value.get("active_job_id") or ""))
        active_call_id = str((active_job or {}).get("call_id") or "")
        cancelled = list(
            dict.fromkeys([str(value.get("active_job_id") or "")] + _queued_job_ids(user_key))
        )
        for job_id in cancelled:
            if job_id:
                _set_job(
                    user_key,
                    job_id,
                    status="cancelled",
                    phase="cancelled",
                    progress=0,
                    message="VIDEO GENERATION CANCELLED",
                    completed_at=time.time(),
                )
        _set(
            user_key,
            status="stopping",
            accepting_jobs=False,
            message="Cancelling GPU jobs",
            stage="releasing_gpus",
            shutdown_requested_at=time.time(),
            paid_deadline_at=None,
            paid_remaining_seconds=paid_remaining,
            generation_queue=[],
            active_job_id=None,
            active_jobs=0,
        )

        # Prevent cancelled inputs from being rescheduled onto replacement
        # containers, then cancel startup and every durable spawned job.
        runners = _disable_user_pool(user_key, "Releasing B300")
        cancellation_errors: list[str] = []
        cancellation_call_ids = list(
            dict.fromkeys(
                ([startup_call_id] if startup_call_id else [])
                + ([active_call_id] if active_call_id else [])
                + call_ids
            )
        )
        for call_id in cancellation_call_ids:
            try:
                modal.FunctionCall.from_id(call_id).cancel(
                    terminate_containers=(call_id == active_call_id or call_id == startup_call_id)
                )
            except Exception as error:
                cancellation_errors.append(f"{call_id}:{str(error)[:300]}")
        _set(
            user_key,
            generation_call_ids=[],
            startup_call_id=None,
            startup_token=None,
            error=("; ".join(cancellation_errors) if cancellation_errors else None),
        )
        _log(
            "shutdown_calls_cancelled",
            user_key,
            session_id=session_id,
            cancelled_call_count=len(cancellation_call_ids),
            cancellation_error_count=len(cancellation_errors),
            paid_remaining_seconds=paid_remaining,
        )
        if runners == 0:
            stopping_value = _get(user_key)
            off_state = _default()
            off_state.update(
                message="GPU stopped",
                stopped_at=time.time(),
                paid_remaining_seconds=paid_remaining,
                paid_balance_pending=bool(stopping_value.get("paid_balance_pending")),
                session_id=session_id,
            )
            _set(user_key, **off_state)
        return _response(user_key, runners)

    @api.post("/extend-time")
    def extend_time(body: dict[str, object]) -> dict[str, object]:
        user_key = _validate_user_key(body.get("user_key"))
        added_seconds = max(0, int(body.get("added_seconds") or 0))
        if added_seconds <= 0:
            raise HTTPException(400, "GPU time extension must be positive.")
        value = _get(user_key)
        if value.get("status") not in {"starting", "ready"}:
            raise HTTPException(409, "GPU time can only be extended during an active session.")
        now = time.time()
        if value.get("paid_deadline_at"):
            current_deadline = float(value["paid_deadline_at"])
            paid_deadline = max(current_deadline, now) + added_seconds
            _set(
                user_key,
                paid_deadline_at=paid_deadline,
                paid_remaining_seconds=max(0, int(math.ceil(paid_deadline - now))),
                paid_balance_pending=True,
            )
        else:
            _set(
                user_key,
                paid_deadline_at=None,
                paid_remaining_seconds=_paid_remaining_seconds(value, now) + added_seconds,
                paid_balance_pending=True,
            )
        _log("paid_time_extended", user_key, added_seconds=added_seconds)
        return _response(user_key, _runners(user_key))

    @api.post("/ack-time")
    def acknowledge_time(body: dict[str, object]) -> dict[str, object]:
        user_key = _validate_user_key(body.get("user_key"))
        value = _get(user_key)
        if value.get("status") in {"starting", "ready"}:
            raise HTTPException(409, "Active GPU time cannot be settled yet.")
        expected_session_id = str(body.get("session_id") or "")
        current_session_id = str(value.get("session_id") or "")
        if (
            expected_session_id
            and expected_session_id != "legacy"
            and current_session_id != expected_session_id
        ):
            raise HTTPException(409, "GPU session changed before time settlement completed.")
        _set(
            user_key,
            paid_deadline_at=None,
            paid_remaining_seconds=None,
            paid_balance_pending=False,
        )
        _log("paid_time_settled", user_key)
        return _response(user_key, _runners(user_key))

    @api.post("/generate")
    def generate(body: dict[str, object]) -> dict[str, object]:
        user_key = _validate_user_key(body.get("user_key"))
        value = _get(user_key)
        if value.get("status") != "ready":
            raise HTTPException(409, "Start the LTX GPU and wait until it is ready.")
        if _paid_remaining_seconds(value) <= 0:
            raise HTTPException(402, "GPU time has ended. Add time to continue.")
        session_id = str(value.get("session_id") or "")
        if not session_id or not value.get("accepting_jobs"):
            raise HTTPException(409, "GPU shutdown is in progress.")
        scene_key = str(body.get("scene_key") or "").strip()
        if not scene_key:
            # Older already-open clients do not send a scene key. Keep those
            # requests working without allowing one legacy job to replace another.
            scene_key = f"legacy-{uuid.uuid4().hex}"
        elif len(scene_key) > 160:
            raise HTTPException(400, "A valid scene key is required for GPU generation.")

        active_job_id = str(value.get("active_job_id") or "")
        existing_job_ids = list(
            dict.fromkeys(([active_job_id] if active_job_id else []) + _queued_job_ids(user_key))
        )
        replaced_job_ids: list[str] = []
        cancelled_call_ids: set[str] = set()
        replaced_active_job = False
        for existing_job_id in existing_job_ids:
            existing_job = _get_job(user_key, existing_job_id)
            if not existing_job or str(existing_job.get("scene_key") or "") != scene_key:
                continue
            if existing_job.get("status") in {"succeeded", "failed", "cancelled"}:
                continue
            call_id = str(existing_job.get("call_id") or "")
            is_active_scene_job = existing_job_id == active_job_id
            if call_id and _call_is_active(call_id):
                try:
                    modal.FunctionCall.from_id(call_id).cancel(
                        terminate_containers=False
                    )
                except Exception as error:
                    _log(
                        "scene_replacement_cancel_failed",
                        user_key,
                        job_id=existing_job_id,
                        error=str(error)[:500],
                    )
            if call_id:
                cancelled_call_ids.add(call_id)
            # Cancelling a scene must not terminate the shared warm B300. Doing
            # so causes Modal to cold-start replacement containers for queued
            # calls and was the source of the production container storm.
            replaced_active_job = replaced_active_job or is_active_scene_job
            replaced_job_ids.append(existing_job_id)
            _set_job(
                user_key,
                existing_job_id,
                status="cancelled",
                phase="cancelled",
                progress=0,
                message="REPLACED BY NEW VIDEO FOR THIS SCENE",
                completed_at=time.time(),
            )

        if replaced_job_ids:
            remaining_queue = [
                queued_job_id
                for queued_job_id in _queued_job_ids(user_key)
                if queued_job_id not in replaced_job_ids
            ]
            remaining_call_ids = [
                call_id
                for call_id in _generation_call_ids(_get(user_key))
                if call_id not in cancelled_call_ids
            ]
            replacement_updates: dict[str, object] = {
                "generation_queue": remaining_queue,
                "generation_call_ids": remaining_call_ids,
                "active_job_id": None if replaced_active_job else active_job_id or None,
                "active_jobs": len(remaining_queue),
                "last_activity_at": time.time(),
                "message": "Replacing this scene's video",
            }
            _set(user_key, **replacement_updates)
            _refresh_queue_positions(user_key, remaining_queue)
            _log(
                "scene_generation_replaced",
                user_key,
                scene_key=scene_key,
                replaced_job_ids=replaced_job_ids,
                worker_restarted=False,
            )

        payload = dict(body)
        payload.pop("user_key", None)
        job_id = uuid.uuid4().hex
        queue = _queued_job_ids(user_key)
        queue.append(job_id)
        queue_position = len(queue)
        _set_job(
            user_key,
            job_id,
            status="queued",
            phase="queued",
            progress=1,
            queue_position=queue_position,
            scene_key=scene_key,
            session_id=session_id,
            message=(
                "VIDEO QUEUED · NEXT"
                if queue_position == 1
                else f"VIDEO QUEUED · {queue_position - 1} AHEAD"
            ),
        )
        _set(
            user_key,
            generation_queue=queue,
            active_jobs=len(queue) + (1 if _get(user_key).get("active_job_id") else 0),
            last_activity_at=time.time(),
            message="Video queued",
        )
        payload["job_id"] = job_id
        payload["session_id"] = session_id
        if not _session_is_active(user_key, session_id):
            queue = [item for item in _queued_job_ids(user_key) if item != job_id]
            _set_job(
                user_key,
                job_id,
                status="cancelled",
                phase="cancelled",
                progress=0,
                message="VIDEO GENERATION CANCELLED",
                completed_at=time.time(),
            )
            _set(user_key, generation_queue=queue, active_jobs=len(queue))
            _refresh_queue_positions(user_key, queue)
            return {
                "status": "cancelled",
                "jobId": job_id,
                "phase": "cancelled",
                "progress": 0,
                "message": "VIDEO GENERATION CANCELLED",
            }
        try:
            call = LTX25Session(user_key=user_key).generate.spawn(payload)
        except Exception as error:
            queue = [item for item in _queued_job_ids(user_key) if item != job_id]
            _set_job(
                user_key,
                job_id,
                status="failed",
                phase="failed",
                progress=0,
                message="VIDEO QUEUE FAILED",
                error=str(error)[:1000],
            )
            _set(user_key, generation_queue=queue, active_jobs=len(queue))
            _refresh_queue_positions(user_key, queue)
            raise
        if not _session_is_active(user_key, session_id):
            try:
                modal.FunctionCall.from_id(call.object_id).cancel(terminate_containers=False)
            except Exception as error:
                _log(
                    "shutdown_race_cancel_failed",
                    user_key,
                    job_id=job_id,
                    call_id=call.object_id,
                    error=str(error)[:500],
                )
            queue = [item for item in _queued_job_ids(user_key) if item != job_id]
            _set_job(
                user_key,
                job_id,
                call_id=call.object_id,
                status="cancelled",
                phase="cancelled",
                progress=0,
                message="VIDEO GENERATION CANCELLED",
                completed_at=time.time(),
            )
            _set(user_key, generation_queue=queue, active_jobs=len(queue))
            _refresh_queue_positions(user_key, queue)
            return {
                "status": "cancelled",
                "jobId": job_id,
                "phase": "cancelled",
                "progress": 0,
                "message": "VIDEO GENERATION CANCELLED",
            }
        call_ids = _generation_call_ids(_get(user_key))
        call_ids.append(call.object_id)
        _set_job(user_key, job_id, call_id=call.object_id)
        _set(user_key, generation_call_ids=call_ids)
        # The call ID must be visible to /stop before the final session check.
        # If shutdown won the race, cancel this now-registered call; otherwise a
        # later shutdown will include it in generation_call_ids.
        if not _session_is_active(user_key, session_id):
            try:
                modal.FunctionCall.from_id(call.object_id).cancel(terminate_containers=False)
            except Exception as error:
                _log(
                    "registered_shutdown_race_cancel_failed",
                    user_key,
                    job_id=job_id,
                    call_id=call.object_id,
                    error=str(error)[:500],
                )
            queue = [item for item in _queued_job_ids(user_key) if item != job_id]
            remaining_call_ids = [
                call_id
                for call_id in _generation_call_ids(_get(user_key))
                if call_id != call.object_id
            ]
            _set_job(
                user_key,
                job_id,
                status="cancelled",
                phase="cancelled",
                progress=0,
                message="VIDEO GENERATION CANCELLED",
                completed_at=time.time(),
            )
            _set(
                user_key,
                generation_queue=queue,
                generation_call_ids=remaining_call_ids,
                active_jobs=len(queue),
            )
            _refresh_queue_positions(user_key, queue)
            return {
                "status": "cancelled",
                "jobId": job_id,
                "phase": "cancelled",
                "progress": 0,
                "message": "VIDEO GENERATION CANCELLED",
            }
        return {
            "status": "queued",
            "jobId": job_id,
            "phase": "queued",
            "progress": 1,
            "queue_position": queue_position,
            "replacedJobIds": replaced_job_ids,
            "message": (
                "VIDEO QUEUED · NEXT"
                if queue_position == 1
                else f"VIDEO QUEUED · {queue_position - 1} AHEAD"
            ),
        }

    @api.get("/generation-status")
    def generation_status(
        user_key: str = Query(...), job_id: str = Query(...)
    ) -> dict[str, object]:
        user_key = _validate_user_key(user_key)
        job = _get_job(user_key, job_id)
        if not job:
            raise HTTPException(404, "LTX video generation job not found.")
        session_value = _get(user_key)
        job["active_jobs"] = int(session_value.get("active_jobs") or 0)
        job["paid_remaining_seconds"] = _reported_paid_remaining(session_value)
        if str(job.get("status")) in {"succeeded", "failed", "cancelled"}:
            if (
                job.get("paid_remaining_seconds") is not None
                and int(job["paid_remaining_seconds"]) <= 0
                and session_value.get("status") == "ready"
                and not session_value.get("active_jobs")
            ):
                _disable_user_pool(user_key, "GPU time ended · releasing B300")
            return job
        call_id = str(job.get("call_id") or "")
        if call_id and not _call_is_active(call_id):
            try:
                result = modal.FunctionCall.from_id(call_id).get(timeout=0)
                if isinstance(result, dict):
                    return _set_job(
                        user_key,
                        job_id,
                        status="succeeded",
                        phase="completed",
                        progress=100,
                        message="VIDEO READY",
                        videoUrl=result.get("videoUrl"),
                        output_key=result.get("output_key"),
                        generation_seconds=result.get("generation_seconds"),
                        completed_at=time.time(),
                        paid_remaining_seconds=_reported_paid_remaining(_get(user_key)),
                        error=None,
                    )
                raise RuntimeError("Modal generation ended without an LTX video result")
            except Exception as error:
                return _set_job(
                    user_key,
                    job_id,
                    status="failed",
                    phase="failed",
                    progress=0,
                    message="VIDEO GENERATION FAILED",
                    completed_at=time.time(),
                    paid_remaining_seconds=_reported_paid_remaining(_get(user_key)),
                    error=str(error)[:1000],
                )
        return job

    return api


@app.local_entrypoint()
def benchmark(
    image_path: str,
    prompt: str = "The subject moves naturally while the camera makes a slow cinematic push forward.",
    output_path: str = "ltx25-b300-1080p-test.mp4",
    seed: int = 3101,
    orientation: str = "landscape",
) -> None:
    """Run one paid B300 benchmark without touching the ClikB backend or UI."""
    local_image = Path(image_path).expanduser().resolve()
    if not local_image.is_file():
        raise FileNotFoundError(local_image)
    image_bytes = local_image.read_bytes()
    image_mime = mimetypes.guess_type(local_image.name)[0] or "image/png"
    normalized_orientation = orientation.strip().lower()
    if normalized_orientation == "landscape":
        width, height = LANDSCAPE_MODEL_SIZE
    elif normalized_orientation == "portrait":
        width, height = PORTRAIT_MODEL_SIZE
    else:
        raise ValueError("orientation must be 'landscape' or 'portrait'")
    user_key = f"benchmark-{uuid.uuid4().hex[:16]}"
    job_id = uuid.uuid4().hex
    result = LTX25Session(user_key=user_key).generate.remote(
        {
            "job_id": job_id,
            "prompt": prompt,
            "duration": DEFAULT_SECONDS,
            "width": width,
            "height": height,
            "seed": seed,
            "_benchmark_image_bytes": image_bytes,
            "_benchmark_image_mime": image_mime,
        }
    )
    output_key = str(result.get("output_key") or "")
    if not output_key:
        raise RuntimeError(f"Benchmark returned no output key: {result}")
    destination = Path(output_path).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as output:
        for chunk in output_volume.read_file(output_key):
            output.write(chunk)
    print(json.dumps({**result, "local_output": str(destination)}, indent=2), flush=True)
