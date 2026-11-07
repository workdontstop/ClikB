"""Per-user MiniMax-H3 Ref2VA sessions for ClikB.

This keeps the existing FAL H3 integration intact.  ClikB selects this transport
only while a user's GPU session is ready.
"""

import json
import mimetypes
import os
import re
import subprocess
import threading
import time
import urllib.parse
import urllib.request
import uuid
from collections import deque
from pathlib import Path

import modal


APP_NAME = os.environ.get("CLIKB_H3_APP_NAME", "clikb-h3-ref2va")
GPU_TYPE = os.environ.get("CLIKB_H3_GPU_TYPE", "B200")
GPU_LABEL = os.environ.get("CLIKB_H3_GPU_LABEL", "B200")
STATE_NAME = os.environ.get("CLIKB_H3_STATE_NAME", "clikb-h3-ref2va-user-sessions")
MODEL_ROOT = Path("/models/MiniMax-H3")
SGLANG_PORT = 30011
STARTUP_TIMEOUT = int(os.environ.get("CLIKB_H3_STARTUP_TIMEOUT_SECONDS", "900"))
IDLE_TIMEOUT = 5 * 60
MAX_REFERENCE_BYTES = 250 * 1024 * 1024

app = modal.App(APP_NAME)
model_volume = modal.Volume.from_name("clikb-minimax-h3-ref2va", create_if_missing=False)
states = modal.Dict.from_name(STATE_NAME, create_if_missing=True)

deployment_env = {
    "CLIKB_H3_APP_NAME": APP_NAME,
    "CLIKB_H3_GPU_TYPE": GPU_TYPE,
    "CLIKB_H3_GPU_LABEL": GPU_LABEL,
    "CLIKB_H3_STATE_NAME": STATE_NAME,
    "CLIKB_H3_STARTUP_TIMEOUT_SECONDS": str(STARTUP_TIMEOUT),
}

control_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi==0.116.1")
    .env(deployment_env)
)
gpu_image = (
    modal.Image.from_registry("lmsysorg/sglang:dev")
    .run_commands('cd /sgl-workspace/sglang && pip install -e "python[diffusion]"')
    .env({
        "PYTHONUNBUFFERED": "1",
        "NCCL_DEBUG": "WARN",
        "TOKENIZERS_PARALLELISM": "false",
    })
)
if GPU_TYPE == "B300":
    gpu_image = (
        gpu_image
        .run_commands(
            "apt-get update",
            "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends cuda-toolkit-13-1",
            "ln -sfn /usr/local/cuda-13.1 /usr/local/cuda",
            "rm -rf /var/lib/apt/lists/*",
            "/usr/local/cuda-13.1/bin/nvcc --version",
        )
        .env({"CUDA_HOME": "/usr/local/cuda-13.1"})
    )
gpu_image = gpu_image.env(deployment_env)


def _command() -> list[str]:
    return [
        "sglang", "serve", "--model-path", str(MODEL_ROOT),
        "--model-variant", "ref2va", "--num-gpus", "1",
        "--ulysses-degree", "1", "--encoder-parallel", "auto",
        "--performance-mode", "speed", "--host", "127.0.0.1",
        "--port", str(SGLANG_PORT),
    ]


def _default() -> dict[str, object]:
    return {
        "status": "off", "message": "GPU is off", "stage": "off",
        "stage_index": 0, "stage_total": 4, "gpu_count": 0,
        "active_containers": 0, "active_jobs": 0, "started_at": None,
        "ready_at": None, "last_activity_at": None, "stopped_at": None,
        "shutdown_requested_at": None,
        "startup_call_id": None,
        "startup_token": None,
        "generation_call_id": None, "generation_call_ids": [],
        "generation_queue": [], "active_job_id": None,
        "generation_status": None,
        "generation_result": None, "error": None,
    }


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
    value = _get(user_key).get("generation_queue")
    return [str(item) for item in value] if isinstance(value, list) else []


def _refresh_queue_positions(user_key: str, queue: list[str]) -> None:
    for position, queued_job_id in enumerate(queue, start=1):
        if _get_job(user_key, queued_job_id):
            _set_job(
                user_key,
                queued_job_id,
                status="queued",
                phase="queued",
                progress=1,
                queue_position=position,
                message=("VIDEO QUEUED · NEXT" if position == 1 else f"VIDEO QUEUED · {position - 1} AHEAD"),
            )


def _denoise_progress(lines: deque[str]) -> tuple[int, int, int] | None:
    pattern = re.compile(r"denoise:\s+(\d+)%.*?\|\s*(\d+)/(\d+)")
    for line in reversed(lines):
        match = pattern.search(line)
        if match:
            return int(match.group(1)), int(match.group(2)), int(match.group(3))
    return None


def _validate_user_key(value: object) -> str:
    user_key = str(value or "").strip()
    if not user_key or len(user_key) > 96 or not all(c.isalnum() or c in "-_" for c in user_key):
        raise ValueError("Invalid user session key")
    return user_key


def _log(event: str, user_key: str, **details: object) -> None:
    """One-line lifecycle logs that are safe to inspect in Modal."""
    print(json.dumps({
        "component": "clikb_h3_lifecycle",
        "event": event,
        "session": user_key[:12],
        "timestamp": round(time.time(), 3),
        **details,
    }, default=str, sort_keys=True), flush=True)


def _json_request(url: str, body: dict[str, object] | None = None, timeout: int = 30) -> dict[str, object]:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
    parsed = json.loads(raw) if raw else {}
    if not isinstance(parsed, dict):
        raise RuntimeError("Invalid response from H3")
    return parsed


def _wait_ready(process: subprocess.Popen[str]) -> float:
    started = time.monotonic()
    while time.monotonic() - started < STARTUP_TIMEOUT:
        if process.poll() is not None:
            raise RuntimeError(f"SGLang exited during startup ({process.returncode})")
        try:
            _json_request(f"http://127.0.0.1:{SGLANG_PORT}/v1/models", timeout=5)
            return time.monotonic() - started
        except Exception:
            time.sleep(5)
    raise TimeoutError("MiniMax-H3 startup timed out")


def _stream_process_output(process: subprocess.Popen[str], tail: deque[str]) -> None:
    """Expose SGLang startup output in Modal while retaining a short error tail."""
    if process.stdout is None:
        return
    for raw_line in process.stdout:
        line = raw_line.rstrip()
        if not line:
            continue
        tail.append(line)
        print(f"[SGLang] {line}", flush=True)


def _download(url: str, destination: Path) -> Path:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("Reference media must use HTTPS")
    total = 0
    request = urllib.request.Request(url, headers={"User-Agent": "ClikB-H3/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response, destination.open("wb") as output:
        if int(response.headers.get("Content-Length") or 0) > MAX_REFERENCE_BYTES:
            raise ValueError("Reference media is too large")
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_REFERENCE_BYTES:
                raise ValueError("Reference media is too large")
            output.write(chunk)
    return destination


def _suffix(url: str, mime: str) -> str:
    suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
    return suffix if suffix and len(suffix) <= 8 else (mimetypes.guess_extension(mime) or ".bin")


def _response(user_key: str, runners: int | None = None) -> dict[str, object]:
    value = _get(user_key)
    value["gpu_label"] = GPU_LABEL
    if runners is not None:
        value["active_containers"] = runners
    origin = value.get("ready_at") or value.get("started_at")
    value["uptime_seconds"] = max(0, int(time.time() - float(origin))) if origin else 0
    last = value.get("last_activity_at")
    value["idle_seconds_remaining"] = (
        max(0, IDLE_TIMEOUT - int(time.time() - float(last)))
        if value.get("status") == "ready" and not value.get("active_jobs") and last else 0
    )
    value["idle_timeout_seconds"] = IDLE_TIMEOUT
    return value


@app.cls(
    image=gpu_image, gpu=GPU_TYPE, cpu=16, memory=196608,
    timeout=24 * 60 * 60, min_containers=0, max_containers=1,
    scaledown_window=IDLE_TIMEOUT, volumes={"/models": model_volume},
)
@modal.concurrent(max_inputs=1)
class H3Session:
    user_key: str = modal.parameter()

    @modal.enter()
    def boot(self) -> None:
        _set(self.user_key, status="starting", message="Loading MiniMax-H3 Ref2VA",
             stage="loading_model", stage_index=3, gpu_count=1, active_containers=1)
        self.log_tail: deque[str] = deque(maxlen=40)
        _log("sglang_starting", self.user_key, command=_command(),
             startup_timeout_seconds=STARTUP_TIMEOUT)
        self.process = subprocess.Popen(
            _command(),
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
            diagnostic_tail = "\n".join(self.log_tail)[-8000:]
            _set(self.user_key, status="error", stage="error",
                 message="MiniMax-H3 failed to start",
                 error=str(error), startup_log_tail=diagnostic_tail)
            _log("sglang_startup_failed", self.user_key,
                 error_type=type(error).__name__, error=str(error),
                 startup_log_tail=diagnostic_tail)
            raise
        now = time.time()
        _set(self.user_key, status="starting", message="Finalizing MiniMax-H3 Ref2VA",
             stage="finalizing", stage_index=4, gpu_count=1, active_containers=1,
             startup_seconds=round(startup_seconds, 2), error=None)
        _log("sglang_ready", self.user_key, startup_seconds=round(startup_seconds, 2))

    @modal.exit()
    def shutdown(self) -> None:
        if getattr(self, "process", None) is not None and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                self.process.kill()
        log_thread = getattr(self, "log_thread", None)
        if log_thread is not None:
            log_thread.join(timeout=2)

    @modal.method()
    def warmup(self, startup_token: str) -> dict[str, object]:
        """Finish one real Modal input, leaving this initialized container idle.

        The five-minute ``scaledown_window`` then keeps this exact worker warm
        and available for the next ``generate`` input without holding an input
        slot open or forcing a permanently provisioned minimum container.
        """
        current = _get(self.user_key)
        if (
            current.get("status") != "starting"
            or current.get("startup_token") != startup_token
        ):
            _log(
                "stale_warmup_ignored",
                self.user_key,
                current_status=current.get("status"),
                token_matches=current.get("startup_token") == startup_token,
            )
            return current
        now = time.time()
        value = _set(
            self.user_key,
            status="ready",
            message=f"GPU ready · 1× {GPU_LABEL}",
            stage="ready",
            stage_index=4,
            gpu_count=1,
            active_containers=1,
            ready_at=now,
            last_activity_at=now,
            startup_token=None,
            error=None,
        )
        _log("warmup_completed", self.user_key)
        return value

    @modal.method()
    def generate(self, payload: dict[str, object]) -> dict[str, object]:
        job_id = str(payload.pop("job_id", "")).strip()
        if not job_id:
            raise ValueError("A GPU queue job ID is required")
        queue = [queued for queued in _queued_job_ids(self.user_key) if queued != job_id]
        _set(self.user_key, generation_queue=queue, active_jobs=len(queue) + 1,
             active_job_id=job_id,
             generation_call_id=str((_get_job(self.user_key, job_id) or {}).get("call_id") or ""),
             generation_status="running", last_activity_at=time.time(),
             message="Generating with MiniMax-H3", error=None)
        _refresh_queue_positions(self.user_key, queue)
        _set_job(self.user_key, job_id, status="running", phase="preparing", progress=3,
                 queue_position=0, started_at=time.time(), message="PREPARING REFERENCES")
        job_dir = Path(f"/tmp/h3-job-{job_id}")
        job_dir.mkdir(parents=True)
        try:
            prompt = str(payload.get("prompt") or "").strip()
            if not prompt:
                raise ValueError("A video prompt is required")
            duration = max(4, min(15, int(payload.get("duration") or 5)))
            ratio = str(payload.get("aspect_ratio") or "16:9")
            if ratio not in {"16:9", "9:16", "1:1", "4:3", "3:4"}:
                ratio = "16:9"
            conditions: list[dict[str, object]] = []
            tags: list[str] = []
            refs = payload.get("image_references")
            _set_job(self.user_key, job_id, phase="references", progress=5,
                     message="LOADING REFERENCE IMAGES")
            for index, ref in enumerate(refs[:9] if isinstance(refs, list) else [], start=1):
                if not isinstance(ref, dict) or not ref.get("url"):
                    continue
                url = str(ref["url"])
                path = _download(url, job_dir / f"picture-{index}{_suffix(url, 'image/jpeg')}")
                conditions.append({"type": "image", "uri": path.as_uri(), "role": "reference"})
                tags.append(f"<Picture {index}> is the visual reference for {ref.get('name') or f'material {index}' }.")
            video_url = str(payload.get("reference_video_url") or "")
            if video_url:
                path = _download(video_url, job_dir / f"video-1{_suffix(video_url, 'video/mp4')}")
                conditions.append({"type": "video", "uri": path.as_uri(), "role": "reference", "start_time_seconds": 0})
                tags.append("<Video 1> is the motion reference.")
            audio_url = str(payload.get("reference_audio_url") or "")
            if audio_url:
                path = _download(audio_url, job_dir / f"audio-1{_suffix(audio_url, 'audio/mpeg')}")
                conditions.append({"type": "audio", "uri": path.as_uri(), "role": "reference"})
                tags.append("<Audio 1> is the sound reference.")
            request_body: dict[str, object] = {
                "model": "MiniMaxAI/MiniMax-H3", "prompt": " ".join(tags) + "\n\n" + prompt,
                "seconds": duration, "task": "ref2va", "conditions": conditions,
                "target": {"short_edge": 768, "aspect_ratio": ratio, "duration_seconds": float(duration)},
                "num_outputs_per_prompt": 1, "num_inference_steps": 50,
                "flow_shift": 12.0, "audio_flow_shift": 3.0,
                "seed": int(payload.get("seed") or 3101),
            }
            _set_job(self.user_key, job_id, phase="submitting", progress=8,
                     message="SENDING SCENE TO MINIMAX-H3")
            submitted = _json_request(f"http://127.0.0.1:{SGLANG_PORT}/v1/videos", request_body, 60)
            video_id = str(submitted.get("id") or "")
            if not video_id:
                raise RuntimeError("H3 did not return a video job ID")
            _set_job(self.user_key, job_id, phase="denoising", progress=10,
                     model_job_id=video_id, message="GENERATING VIDEO · 0/49")
            deadline = time.monotonic() + 2 * 60 * 60
            while time.monotonic() < deadline:
                progress = _json_request(f"http://127.0.0.1:{SGLANG_PORT}/v1/videos/{video_id}", timeout=30)
                status = str(progress.get("status") or "").lower()
                if status in {"completed", "succeeded"}:
                    break
                if status in {"failed", "cancelled", "canceled"}:
                    raise RuntimeError(str(progress.get("error") or "H3 generation failed"))
                denoise = _denoise_progress(self.log_tail)
                if denoise:
                    percent, step, total = denoise
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
                time.sleep(3)
            else:
                raise TimeoutError("H3 generation timed out")
            _set_job(self.user_key, job_id, phase="decoding", progress=92,
                     message="DECODING VIDEO")
            with urllib.request.urlopen(
                f"http://127.0.0.1:{SGLANG_PORT}/v1/videos/{video_id}/content", timeout=300
            ) as response:
                result_bytes = response.read()
            _set_job(self.user_key, job_id, phase="uploading", progress=97,
                     message="UPLOADING VIDEO TO S3")
            upload = urllib.request.Request(
                str(payload["upload_url"]), data=result_bytes, method="PUT",
                headers={"Content-Type": "video/mp4", "Cache-Control": "public, max-age=31536000, immutable"},
            )
            with urllib.request.urlopen(upload, timeout=900) as response:
                if response.status not in {200, 204}:
                    raise RuntimeError(f"S3 upload failed ({response.status})")
            result = {"status": "succeeded", "videoUrl": str(payload["video_url"])}
            _set_job(self.user_key, job_id, status="succeeded", phase="completed", progress=100,
                     message="VIDEO READY", videoUrl=result["videoUrl"], result=result,
                     completed_at=time.time(), error=None)
            remaining_queue = _queued_job_ids(self.user_key)
            own_call_id = str((_get_job(self.user_key, job_id) or {}).get("call_id") or "")
            remaining_call_ids = [call_id for call_id in _generation_call_ids(_get(self.user_key)) if call_id != own_call_id]
            _set(self.user_key, active_jobs=len(remaining_queue), active_job_id=None,
                 generation_call_ids=remaining_call_ids,
                 generation_status="succeeded",
                 generation_result=result, last_activity_at=time.time(), message="Video saved")
            return result
        except Exception as error:
            _set_job(self.user_key, job_id, status="failed", phase="failed", progress=0,
                     message="VIDEO GENERATION FAILED", completed_at=time.time(), error=str(error)[:1000])
            remaining_queue = _queued_job_ids(self.user_key)
            own_call_id = str((_get_job(self.user_key, job_id) or {}).get("call_id") or "")
            remaining_call_ids = [call_id for call_id in _generation_call_ids(_get(self.user_key)) if call_id != own_call_id]
            _set(self.user_key, active_jobs=len(remaining_queue), active_job_id=None,
                 generation_call_ids=remaining_call_ids,
                 generation_status="failed", generation_result=None,
                 last_activity_at=time.time(), message="Video generation failed", error=str(error)[:1000])
            raise


def _runners(user_key: str) -> int | None:
    try:
        return int(H3Session(user_key=user_key).get_current_stats().num_total_runners)
    except Exception:
        return None


def _call_is_active(call_id: object) -> bool:
    if not call_id:
        return False
    try:
        modal.FunctionCall.from_id(str(call_id)).get(timeout=0)
        return False
    except TimeoutError:
        return True
    except Exception:
        # Cancelled, failed, and unknown calls are terminal for lifecycle
        # reconciliation. They must never hold the UI in `stopping` forever.
        return False


def _generation_call_ids(value: dict[str, object]) -> list[str]:
    call_ids = value.get("generation_call_ids")
    if isinstance(call_ids, list):
        return [str(call_id) for call_id in call_ids if call_id]
    legacy_call_id = value.get("generation_call_id")
    return [str(legacy_call_id)] if legacy_call_id else []


def _disable_user_pool(user_key: str, reason: str) -> int | None:
    """Scale one parameterized user's GPU pool to zero."""
    _set(
        user_key,
        status="stopping",
        message=reason,
        stage="releasing_gpus",
        shutdown_requested_at=time.time(),
        error=None,
    )
    settings = H3Session(user_key=user_key).update_autoscaler(
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
    """CPU-only safety net that releases inactive per-user GPU pools."""
    now = time.time()
    for stored_key, raw_value in states.items():
        if not isinstance(stored_key, str) or not stored_key.startswith("user:"):
            continue
        if not isinstance(raw_value, dict):
            continue
        user_key = stored_key.removeprefix("user:")
        if raw_value.get("status") != "ready" or raw_value.get("active_jobs"):
            continue
        last_activity = raw_value.get("last_activity_at")
        if not last_activity or now - float(last_activity) < IDLE_TIMEOUT:
            continue
        try:
            _disable_user_pool(user_key, f"Idle timeout · releasing {GPU_LABEL}")
            _log("idle_pool_release_requested", user_key)
        except Exception as error:
            _set(user_key, error=f"Idle shutdown failed: {str(error)[:500]}")
            _log(
                "idle_pool_release_failed",
                user_key,
                error_type=type(error).__name__,
                error=str(error)[:500],
            )
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
        _log("start_received", user_key, previous_status=current.get("status"),
             previous_generation_call_id=current.get("generation_call_id"))
        runners = _runners(user_key)
        if current.get("status") == "ready" and runners:
            _log("start_deduplicated", user_key, status="ready", runners=runners)
            return _response(user_key, runners)
        if current.get("status") == "starting" and current.get("startup_call_id"):
            _log("start_deduplicated", user_key, status="starting", runners=runners)
            return _response(user_key, runners)
        now = time.time()
        _set(user_key, status="starting", message=f"Waiting for 1× {GPU_LABEL} capacity", stage="requesting_gpus",
             stage_index=1, stage_total=4, gpu_count=0, active_containers=0, active_jobs=0,
             started_at=now, ready_at=None, last_activity_at=now, stopped_at=None,
             shutdown_requested_at=None, startup_call_id=None, startup_token=None,
             generation_call_id=None,
             generation_call_ids=[], generation_queue=[], active_job_id=None,
             generation_status=None, generation_result=None, error=None)
        session = H3Session(user_key=user_key)
        settings = session.update_autoscaler(
            min_containers=0,
            max_containers=1,
            scaledown_window=IDLE_TIMEOUT,
        )
        startup_token = uuid.uuid4().hex
        _set(user_key, startup_token=startup_token)
        call = session.warmup.spawn(startup_token)
        _set(user_key, startup_call_id=call.object_id)
        _log("pool_enabled", user_key, autoscaler_settings=settings)
        _log("startup_warmup_submitted", user_key, runners=runners,
             startup_call_id=call.object_id)
        return _response(user_key, runners)

    @api.get("/status")
    def status(user_key: str = Query(...)) -> dict[str, object]:
        user_key = _validate_user_key(user_key)
        value, runners = _get(user_key), _runners(user_key)
        startup_is_active = _call_is_active(value.get("startup_call_id"))
        generation_is_active = any(_call_is_active(call_id) for call_id in _generation_call_ids(value))
        if (
            value.get("status") == "starting"
            and value.get("startup_call_id")
            and not startup_is_active
        ):
            # ``warmup`` normally writes ready itself. If the Modal call became
            # terminal without doing so, surface a real failure instead of
            # leaving the UI and billing expectations stuck on STARTING.
            try:
                result = modal.FunctionCall.from_id(str(value["startup_call_id"])).get(timeout=0)
                if isinstance(result, dict) and result.get("status") == "ready":
                    value = _set(user_key, **result)
                elif _get(user_key).get("status") == "starting":
                    value = _set(user_key, status="error", stage="error",
                                 message="GPU startup ended before becoming ready",
                                 error="Modal warmup returned without a ready worker")
            except Exception as error:
                value = _set(user_key, status="error", stage="error",
                             message="GPU startup failed", error=str(error)[:1000])
        # modal.Dict survives deployments, while stopping an app destroys its
        # containers. Never let a persisted `ready` record make the UI claim a
        # GPU is running when Modal reports that this user's pool has no runner.
        if value.get("status") == "ready" and runners == 0:
            off_state = _default()
            off_state.update(message="GPU is off", stopped_at=time.time())
            value = _set(user_key, **off_state)
            _log("stale_ready_state_cleared", user_key, runners=runners)
        if value.get("status") == "ready" and not value.get("active_jobs"):
            last_activity = value.get("last_activity_at")
            if last_activity and time.time() - float(last_activity) >= IDLE_TIMEOUT:
                try:
                    runners = _disable_user_pool(user_key, f"Idle timeout · releasing {GPU_LABEL}")
                    value = _get(user_key)
                except Exception as error:
                    _set(user_key, error=f"Idle shutdown failed: {str(error)[:500]}")
        if value.get("status") == "stopping":
            _log("shutdown_status_checked", user_key, runners=runners,
                  generation_is_active=generation_is_active,
                  generation_call_id=value.get("generation_call_id"))
        shutdown_requested_at = (
            value.get("shutdown_requested_at")
            or value.get("updated_at")
            or value.get("started_at")
        )
        stale_shutdown = bool(
            value.get("status") == "stopping"
            and runners is None
            and shutdown_requested_at
            and time.time() - float(shutdown_requested_at) >= 30
            and not generation_is_active
        )
        if value.get("status") == "stopping" and (runners == 0 or stale_shutdown):
            off_state = _default()
            off_state.update(message="GPU stopped", stopped_at=time.time())
            _set(user_key, **off_state)
            _log("shutdown_confirmed", user_key, runners=runners,
                 confirmation="runner_zero" if runners == 0 else "stale_state_without_active_call")
        return _response(user_key, runners)

    @api.post("/stop")
    def stop(body: dict[str, object]) -> dict[str, object]:
        user_key = _validate_user_key(body.get("user_key"))
        value = _get(user_key)
        _log("stop_received", user_key, previous_status=value.get("status"),
             runners_before=_runners(user_key),
             generation_call_id=value.get("generation_call_id"))
        if value.get("status") == "starting":
            _log("stop_rejected_startup_in_progress", user_key)
            value = _set(
                user_key,
                message="GPU startup must finish before it can be stopped",
                error=None,
            )
            return _response(user_key, _runners(user_key))
        if value.get("status") == "off":
            _log("stop_noop_already_off", user_key)
            return _response(user_key, 0)
        _set(user_key, status="stopping", message=f"Releasing {GPU_LABEL}", stage="releasing_gpus",
             shutdown_requested_at=time.time(), error=None)
        for call_id in _generation_call_ids(value):
            if call_id and _call_is_active(call_id):
                try:
                    # Modal requires terminate_containers=False for these spawned
                    # class-method calls. The pool is separately forced to max=0
                    # below so the canceled input cannot be rescheduled.
                    modal.FunctionCall.from_id(str(call_id)).cancel(terminate_containers=False)
                    _log("call_cancel_accepted", user_key, call_id=call_id,
                         terminate_containers=False)
                except Exception as error:
                    _set(user_key, error=f"Cancellation check: {str(error)[:500]}")
                    _log("call_cancel_rejected", user_key, call_id=call_id,
                         error_type=type(error).__name__, error=str(error)[:500])
        cancelled_job_ids = list(dict.fromkeys(
            [str(value.get("active_job_id") or "")] + _queued_job_ids(user_key)
        ))
        for cancelled_job_id in cancelled_job_ids:
            if cancelled_job_id:
                _set_job(user_key, cancelled_job_id, status="cancelled", phase="cancelled", progress=0,
                         message="VIDEO GENERATION CANCELLED", completed_at=time.time())
        _set(user_key, generation_queue=[], active_job_id=None, active_jobs=0)
        try:
            runners = _disable_user_pool(user_key, f"Releasing {GPU_LABEL}")
        except Exception as error:
            _set(user_key, error=f"Scale-to-zero check: {str(error)[:500]}")
            _log("pool_disable_failed", user_key, error_type=type(error).__name__,
                 error=str(error)[:500])
            runners = _runners(user_key)
        if runners == 0:
            off_state = _default()
            off_state.update(message="GPU stopped", stopped_at=time.time())
            _set(user_key, **off_state)
            _log("stop_completed", user_key, runners=runners)
        else:
            _log("stop_pending", user_key, runners=runners)
        return _response(user_key, runners)

    @api.post("/generate")
    def generate(body: dict[str, object]) -> dict[str, object]:
        user_key = _validate_user_key(body.get("user_key"))
        value = _get(user_key)
        if value.get("status") != "ready":
            raise HTTPException(409, "Start the GPU and wait until it is ready.")
        payload = dict(body)
        payload.pop("user_key", None)
        job_id = uuid.uuid4().hex
        queue = _queued_job_ids(user_key)
        queue.append(job_id)
        queue_position = len(queue)
        active_count = len(queue) + (1 if value.get("active_job_id") else 0)
        _set_job(
            user_key,
            job_id,
            status="queued",
            phase="queued",
            progress=1,
            queue_position=queue_position,
            message=("VIDEO QUEUED · NEXT" if queue_position == 1 else f"VIDEO QUEUED · {queue_position - 1} AHEAD"),
        )
        _set(user_key, generation_queue=queue, active_jobs=active_count,
             generation_status="queued", generation_result=None,
             last_activity_at=time.time(), message="Video queued")
        payload["job_id"] = job_id
        try:
            call = H3Session(user_key=user_key).generate.spawn(payload)
        except Exception as error:
            queue = [queued_job_id for queued_job_id in _queued_job_ids(user_key) if queued_job_id != job_id]
            _set_job(user_key, job_id, status="failed", phase="failed", progress=0,
                     message="VIDEO QUEUE FAILED", completed_at=time.time(), error=str(error)[:1000])
            _set(user_key, generation_queue=queue,
                 active_jobs=len(queue) + (1 if _get(user_key).get("active_job_id") else 0))
            _refresh_queue_positions(user_key, queue)
            raise
        call_ids = _generation_call_ids(_get(user_key))
        call_ids.append(call.object_id)
        _set_job(user_key, job_id, call_id=call.object_id)
        _set(user_key, generation_call_id=call.object_id, generation_call_ids=call_ids)
        return {
            "status": "queued",
            "jobId": job_id,
            "phase": "queued",
            "progress": 1,
            "queue_position": queue_position,
            "message": ("VIDEO QUEUED · NEXT" if queue_position == 1 else f"VIDEO QUEUED · {queue_position - 1} AHEAD"),
        }

    @api.get("/generation-status")
    def generation_status(user_key: str = Query(...), job_id: str = Query(...)) -> dict[str, object]:
        user_key = _validate_user_key(user_key)
        job = _get_job(user_key, job_id)
        if not job:
            raise HTTPException(404, "Video generation job not found.")
        job["active_jobs"] = int(_get(user_key).get("active_jobs") or 0)
        status_value = str(job.get("status") or "queued")
        if status_value in {"succeeded", "failed", "cancelled"}:
            return job
        call_id = str(job.get("call_id") or "")
        if call_id and not _call_is_active(call_id):
            try:
                result = modal.FunctionCall.from_id(call_id).get(timeout=0)
                if isinstance(result, dict):
                    job = _set_job(
                        user_key,
                        job_id,
                        status="succeeded",
                        phase="completed",
                        progress=100,
                        message="VIDEO READY",
                        videoUrl=result.get("videoUrl"),
                        result=result,
                        completed_at=time.time(),
                        error=None,
                    )
                    return job
                raise RuntimeError("Modal generation ended without a video result")
            except Exception as error:
                job = _set_job(user_key, job_id, status="failed", phase="failed", progress=0,
                               message="VIDEO GENERATION FAILED", completed_at=time.time(),
                               error=str(error)[:1000])
                return job
        return job

    return api
