"""Isolated ComfyUI LTX-2.5 v2 Modal service; never modifies the H3 app.

No GPU is started by import, deployment, model preparation or preflight.
GPU starts are separately gated by CLIKB_LTX25_V2_ENABLE_GPU=1 at deployment.
The control actor alone writes session balances/queues; GPU workers write
session-scoped lifecycle events and job-scoped results, avoiding stale-session
overwrites. B200 and LTX deployments are intentionally untouched.
"""

import functools
import ipaddress
import json
import os
from pathlib import Path
import socket
import subprocess
import threading
import time
import urllib.parse
import urllib.request
import uuid

import modal

from modal_apps.ltx25_comfy_workflow import (
    COMFY_REVISION, MODEL_FILES, MODEL_REPO,
    build_workflow, paid_remaining, preload_workflow, validate_request,
)

APP_NAME = "clikb-ltx25-i2v-b300-v2"
STATE_NAME = "clikb-ltx25-v2-user-sessions"
MODEL_VOLUME_NAME = "clikb-ltx25-models"
MODEL_ROOT = Path("/models/comfy-ltx25-v2")
COMFY_ROOT = Path("/opt/ComfyUI")
COMFY_DIR = COMFY_ROOT.as_posix()  # Image commands are Linux even when deployed from Windows.
PORT = 8188
IDLE_TIMEOUT = 300
STARTUP_TIMEOUT = 900
GENERATION_TIMEOUT = 1800
ENABLE_GPU = os.environ.get("CLIKB_LTX25_V2_ENABLE_GPU", "0") == "1"
COMFY_LAUNCH_ARGS = [
    "python", str(COMFY_ROOT / "main.py"), "--listen", "127.0.0.1", "--port", str(PORT),
    "--gpu-only", "--preview-method", "none", "--disable-auto-launch",
    "--disable-metadata", "--cache-lru", "32", "--use-sage-attention"]

app = modal.App(APP_NAME)
states = modal.Dict.from_name(STATE_NAME, create_if_missing=False)
model_volume = modal.Volume.from_name(MODEL_VOLUME_NAME, create_if_missing=False)
runtime_env = {"CLIKB_LTX25_V2_ENABLE_GPU": "1" if ENABLE_GPU else "0",
               "PYTHONUNBUFFERED": "1", "TOKENIZERS_PARALLELISM": "false",
               "TORCHINDUCTOR_CACHE_DIR": f"/models/comfy-ltx25-v2-cache/{COMFY_REVISION}/inductor",
               "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1",
               "TORCH_CUDA_ARCH_LIST": "10.0;9.0;8.9", "CUDA_MODULE_LOADING": "LAZY",
               "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
               "NVIDIA_TF32_OVERRIDE": "1", "TORCHINDUCTOR_COMPILE_THREADS": "1"}

# Modal may send many control requests to this CPU container concurrently so
# different users remain responsive. Requests for one user must still be
# serialized: otherwise a slow status poll can write an older session snapshot
# after Start has created a new session and make the GPU worker reject itself.
_control_locks: dict[str, object] = {}


def _serialize_user_control(function):
    @functools.wraps(function)
    def wrapped(user, *args, **kwargs):
        _key(user)
        # CPython's setdefault is atomic under the GIL. Constructing two locks
        # during the first simultaneous request is harmless; every caller uses
        # the one object retained in the dictionary.
        lock = _control_locks.setdefault(user, threading.RLock())
        with lock:
            return function(user, *args, **kwargs)

    return wrapped


control_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi==0.116.1").env(runtime_env)
download_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "huggingface_hub==0.36.0")
gpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git", "ffmpeg", "libgl1", "libglib2.0-0")
    .pip_install("torch==2.11.0", "torchvision==0.26.0", "torchaudio==2.11.0",
                 index_url="https://download.pytorch.org/whl/cu130")
    .run_commands(
        f"git clone https://github.com/Comfy-Org/ComfyUI.git {COMFY_DIR} && cd {COMFY_DIR} && git checkout {COMFY_REVISION}",
        f"cd {COMFY_DIR} && python -m pip install -r requirements.txt",
    )
    .pip_install("sageattention==1.0.6", "websocket-client==1.8.0")
    .env(runtime_env)
    .add_local_file(Path(__file__).with_name("ltx25_comfy_nodes.py"),
                    f"{COMFY_DIR}/custom_nodes/clikb_ltx25.py", copy=True)
)


def _key(user):
    if not isinstance(user, str) or not user or len(user) > 96 or not all(c.isalnum() or c in "-_" for c in user):
        raise ValueError("Invalid user session key")
    return "user:" + user


def _job_key(user, job):
    return f"job:{user}:{job}"


def _runtime_key(user, session):
    return f"runtime:{user}:{session}"


def _get(user):
    return dict(states.get(_key(user)) or {"status": "off", "paid_balance_pending": False})


def _jobs(user, value):
    return [_job(user, job) for job in value.get("job_ids", [])]


def _job(user, job):
    value = dict(states.get(_job_key(user, job)) or {})
    cancelled = states.get(f"cancel:{user}:{job}")
    # Cancellation has its own key so a simultaneous worker write cannot erase it.
    return {**value, **cancelled} if cancelled else value


def _cancel_job(user, job, reason):
    states[f"cancel:{user}:{job}"] = {"status": "cancelled", "phase": "cancelled", "progress": 0,
                                       "message": reason, "completed_at": time.time()}


def _put_job(user, job, **updates):
    key = _job_key(user, job)
    value = _job(user, job)
    # Cancellation is terminal. A late GPU completion must not revive the job.
    if value.get("status") == "cancelled":
        return value
    value.update(updates, updated_at=time.time())
    states[key] = value
    return value


def _snapshot(user):
    value = _get(user)
    runtime = dict(states.get(_runtime_key(user, value.get("session_id"))) or {})
    if runtime.get("startup_timings"):
        value["startup_timings"] = runtime["startup_timings"]
    if value.get("status") in {"starting", "ready", "stopping"}:
        # Allocation is reported by modal.enter, before model preload. Capacity
        # waiting has no allocated_at and does not consume purchased time.
        if runtime.get("allocated_at") and value.get("paid_deadline_at") is None:
            value["billing_started_at"] = runtime["allocated_at"]
            value["paid_deadline_at"] = runtime["allocated_at"] + int(value.get("paid_remaining_seconds") or 0)
        if value.get("status") == "starting" and runtime.get("ready_at"):
            value.update(status="ready", ready_at=runtime["ready_at"], last_activity_at=time.time())
        if runtime.get("error") and value.get("status") in {"starting", "ready"}:
            # A failed worker cannot do useful paid work. Freeze the remaining
            # balance at the recorded failure/release instant while Modal tears
            # down the failed call, rather than charging through a crash loop.
            failed_at = float(runtime.get("failed_at") or value.get("shutdown_requested_at") or time.time())
            value.update(
                status="stopping", error=runtime["error"], stop_reason="LTX-2.5 worker failed",
                paid_remaining_seconds=paid_remaining(value, failed_at), paid_deadline_at=None,
                billing_stopped_at=failed_at, billing_started_at=None,
            )
    jobs = _jobs(user, value)
    live = [j for j in jobs if j.get("status") in {"queued", "running"}]
    value["active_jobs"] = len(live)
    completed = [float(j.get("completed_at") or 0) for j in jobs]
    value["last_activity_at"] = max([float(value.get("last_activity_at") or 0)] + completed)
    return value


def _response(user, value):
    now = time.time()
    status = value.get("status", "off")
    allocated = bool(value.get("billing_started_at")) and status in {"starting", "ready", "stopping"}
    stage = ("loading_model" if allocated else "requesting_gpus") if status == "starting" else status
    messages = {"starting": "GPU allocated · loading LTX-2.5" if allocated else "Waiting for B300 capacity",
                "ready": "GPU ready · LTX-2.5 I2V · 1× B300", "stopping": value.get("stop_reason", "Releasing B300"),
                "off": "GPU is off", "error": "LTX-2.5 failed"}
    public_value = {key: item for key, item in value.items() if key not in {"call_ids", "job_ids"}}
    return {**public_value, "gpu_label": "B300", "model": "ltx-2.5-distilled", "runtime": "comfyui",
            "stage": stage, "stage_index": 3 if status == "starting" and allocated else (4 if status == "ready" else 1),
            "stage_total": 4, "message": messages.get(status, status), "billing_active": allocated,
            "gpu_count": 1 if allocated else 0, "active_containers": 1 if allocated else 0,
            "paid_remaining_seconds": paid_remaining(value, now) if value.get("paid_balance_pending") else None,
            "uptime_seconds": int(now - float(value.get("billing_started_at") or now)),
            "startup_seconds": int(float(value.get("ready_at") or now) - float(value.get("started_at") or now)),
            "idle_seconds_remaining": max(0, IDLE_TIMEOUT - int(now - float(value.get("last_activity_at") or now))) if status == "ready" and not value.get("active_jobs") else 0}


def _json(path, body=None, timeout=10):
    request = urllib.request.Request(f"http://127.0.0.1:{PORT}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        try:
            detail = error.read().decode("utf-8", errors="replace")
        except Exception:
            detail = str(error)
        raise RuntimeError(f"ComfyUI HTTP {error.code}: {detail}") from error


def _stop_process(process):
    """Best-effort subprocess cleanup callable from enter failures and exit."""
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


def _public_url(url):
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password or parts.port not in {None, 443}:
        raise ValueError("Media must use a public HTTPS URL")
    for info in socket.getaddrinfo(parts.hostname, 443):
        if not ipaddress.ip_address(info[4][0]).is_global:
            raise ValueError("Private media addresses are not permitted")
    return url


class _PublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return super().redirect_request(req, fp, code, msg, headers, _public_url(newurl))


def _download(url, path):
    opener = urllib.request.build_opener(_PublicRedirect())
    total = 0
    with opener.open(_public_url(url), timeout=60) as response, path.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > 50 * 1024 * 1024:
                raise ValueError("Opening image exceeds 50 MB")
            output.write(chunk)


def _verify_models(check_hash=False):
    del check_hash  # Hugging Face validates downloads; avoid re-hashing multi-GB weights at boot.
    for name in MODEL_FILES:
        path = MODEL_ROOT / name
        if not path.is_file() or path.stat().st_size < 1024 * 1024:
            raise RuntimeError(f"Missing/incomplete LTX-2.5 file: {name}. Run prepare_models before enabling GPU starts.")


@app.function(image=download_image, cpu=2, memory=4096, timeout=24 * 3600,
              volumes={"/models": model_volume}, secrets=[modal.Secret.from_name("huggingface-secret")])
def prepare_models():
    """Explicit CPU-only download; never called by /start or image build."""
    from huggingface_hub import hf_hub_download
    for name in MODEL_FILES:
        hf_hub_download(MODEL_REPO, name, revision="main", local_dir=str(MODEL_ROOT),
                        token=os.environ.get("HF_TOKEN"))
    _verify_models()
    (MODEL_ROOT / "verified.json").write_text(json.dumps({"repo": MODEL_REPO, "files": sorted(MODEL_FILES)}))
    model_volume.commit()
    return {"status": "prepared", "files": sorted(MODEL_FILES), "gpu_started": False}


@app.function(image=gpu_image, cpu=2, memory=4096, timeout=300, volumes={"/models": model_volume})
def preflight():
    """CPU-only checks. Does not claim CUDA kernels or inference were tested."""
    _verify_models()
    import torch
    import triton
    # Schema discovery loads code, not weights. Never submit a prompt here.
    process = subprocess.Popen(["python", str(COMFY_ROOT / "main.py"), "--cpu", "--listen", "127.0.0.1",
                                "--port", str(PORT), "--disable-auto-launch", "--preview-method", "none"], cwd=COMFY_ROOT)
    try:
        for _ in range(90):
            if process.poll() is not None:
                raise RuntimeError("ComfyUI CPU schema preflight exited")
            try:
                schema = _json("/object_info")
                break
            except Exception:
                time.sleep(2)
        else:
            raise TimeoutError("ComfyUI schema preflight timed out")
        request = validate_request({"prompt": "preflight", "image_url": "https://example.com/frame.png"})
        two_frame_req = validate_request({
            "prompt": "preflight",
            "image_url": "https://example.com/frame.png",
            "last_frame_url": "https://example.com/last.png",
        })
        graphs = [
            preload_workflow(),
            build_workflow(request, "preflight.png", "a" * 32),
            build_workflow(two_frame_req, "preflight.png", "b" * 32, last_image_name="preflight_last.png"),
        ]
        checked = set()
        for graph in graphs:
            for node in graph.values():
                name = node["class_type"]
                if name not in schema:
                    raise RuntimeError(f"Required ComfyUI node failed to load: {name}")
                missing = set(schema[name].get("input", {}).get("required", {})) - set(node["inputs"])
                if missing:
                    raise RuntimeError(f"Missing {name} inputs: {sorted(missing)}")
                checked.add(name)
        return {"status": "preflight_passed", "torch": str(torch.__version__), "triton": str(triton.__version__),
                "model_repo": MODEL_REPO, "nodes": sorted(checked),
                "gpu_started": False, "cuda_inference_tested": False}
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()


def _probe_video(path, request):
    raw = subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)], timeout=60)
    info = json.loads(raw)
    video = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    audio = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    if not video or video["codec_name"] != "h264" or (video["width"], video["height"]) != (request["width"], request["height"]):
        raise RuntimeError("LTX output has an invalid video stream")
    if abs(float(info["format"]["duration"]) - request["frames"] / 24) > 0.3:
        raise RuntimeError("LTX output duration does not match the requested frame count")
    if request["include_audio"] and (not audio or audio["codec_name"] != "aac"):
        raise RuntimeError("LTX output is missing its AAC audio stream")
    if not request["include_audio"] and audio:
        raise RuntimeError("LTX silent output unexpectedly contains an audio stream")
    subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(path), "-f", "null", "-"],
                   check=True, timeout=180, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return {"width": video["width"], "height": video["height"], "duration": float(info["format"]["duration"]),
            "has_audio": audio is not None, "decoded": True}


@app.cls(image=gpu_image, gpu="B300", cpu=8, memory=98304, timeout=3600,
         min_containers=0, max_containers=1, scaledown_window=IDLE_TIMEOUT,
         retries=0, startup_timeout=STARTUP_TIMEOUT + 120, volumes={"/models": model_volume},
         enable_memory_snapshot=True,
         experimental_options={"enable_gpu_snapshot": True})
@modal.concurrent(max_inputs=2)
class LTXSession:
    user_key: str = modal.parameter()
    # A stopped session's late boot can never adopt a newer session's identity.
    session_id: str = modal.parameter()

    def _active(self, job=None):
        value = _get(self.user_key)
        if value.get("session_id") != self.session_id or value.get("status") not in {"starting", "ready"}:
            return False
        runtime = states.get(_runtime_key(self.user_key, self.session_id)) or {}
        if value.get("paid_deadline_at") is None and runtime.get("allocated_at"):
            value["paid_deadline_at"] = runtime["allocated_at"] + int(value.get("paid_remaining_seconds") or 0)
        if paid_remaining(value, time.time()) <= 0:
            return False
        return not job or _job(self.user_key, job).get("status") != "cancelled"

    def _run_graph(self, graph, job=None, timeout=GENERATION_TIMEOUT, node_timings=None,
                   enforce_active=True):
        import websocket
        client_id = uuid.uuid4().hex
        ws = websocket.create_connection(f"ws://127.0.0.1:{PORT}/ws?clientId={client_id}", timeout=1)
        prompt_id = None
        active_node = None
        active_node_started = None
        try:
            submitted = _json("/prompt", {"prompt": graph, "client_id": client_id})
            prompt_id = submitted.get("prompt_id")
            if not prompt_id or submitted.get("node_errors"):
                raise RuntimeError(f"LTX workflow rejected: {submitted.get('node_errors')}")
            started = time.monotonic()
            while time.monotonic() - started < timeout:
                if enforce_active and not self._active(job):
                    raise RuntimeError("GPU time ended or this job/session was cancelled")
                if self.process.poll() is not None:
                    raise RuntimeError("ComfyUI exited while processing the video")
                try:
                    message = ws.recv()
                    event = json.loads(message) if isinstance(message, str) else {}
                except websocket.WebSocketTimeoutException:
                    event = {}
                data = event.get("data", {})
                if job and data.get("prompt_id") == prompt_id:
                    if event.get("type") == "progress":
                        step, total = int(data.get("value", 0)), max(1, int(data.get("max", 20)))
                        _put_job(self.user_key, job, phase="sampling", progress=min(85, 10 + round(75 * step / total)),
                                 message=f"LTX-2.5 · STEP {step}/{total}")
                    elif event.get("type") == "executing":
                        node = data.get("node")
                        now = time.monotonic()
                        if node_timings is not None and active_node is not None and active_node_started is not None:
                            node_timings[active_node] = round(
                                node_timings.get(active_node, 0.0) + now - active_node_started, 3)
                        active_node = str(node) if node is not None else None
                        active_node_started = now if node is not None else None
                        if node in {"video", "audio", "save"}:
                            _put_job(self.user_key, job, phase="decoding", progress=88, message="DECODING VIDEO AND AUDIO")
                        elif node in {"condition", "image"}:
                            _put_job(self.user_key, job, phase="conditioning", progress=7, message="ENCODING OPENING FRAME & PROMPT (QWEN3-VL)")
                        elif node in {"shift", "cache", "sampler", "schedule", "guider"}:
                            _put_job(self.user_key, job, phase="sampling", progress=9, message="INITIALIZING SAMPLER")
                try:
                    history = _json(f"/history/{prompt_id}").get(prompt_id)
                except TimeoutError:
                    # Model loading and long kernels can temporarily starve the
                    # local HTTP server. A single 10s history timeout is only a
                    # missed poll; the graph's overall deadline remains authoritative.
                    history = None
                if history:
                    if history.get("status", {}).get("status_str") == "error":
                        raise RuntimeError("ComfyUI failed: " + str(history.get("status", {}).get("messages", []))[-1200:])
                    if history.get("status", {}).get("completed"):
                        if node_timings is not None and active_node is not None and active_node_started is not None:
                            node_timings[active_node] = round(
                                node_timings.get(active_node, 0.0) + time.monotonic() - active_node_started, 3)
                        return history
            raise TimeoutError("LTX-2.5 workflow exceeded its execution limit")
        except BaseException:
            # Cooperatively end Comfy work before another scene can use this worker.
            # A queued prompt must only be deleted; /interrupt is global and would
            # otherwise stop a different scene that is currently using the GPU.
            # Merely cancelling the Modal Python call would leave its subprocess sampling.
            if prompt_id:
                try:
                    queue = _json("/queue")
                    running = any(len(item) > 1 and item[1] == prompt_id
                                  for item in queue.get("queue_running", []))
                    pending = any(len(item) > 1 and item[1] == prompt_id
                                  for item in queue.get("queue_pending", []))
                    if pending:
                        _json("/queue", {"delete": [prompt_id]})
                    if running:
                        _json("/interrupt", {})
                    for _ in range(60):
                        queue = _json("/queue")
                        running = any(len(item) > 1 and item[1] == prompt_id
                                      for item in queue.get("queue_running", []))
                        pending = any(len(item) > 1 and item[1] == prompt_id
                                      for item in queue.get("queue_pending", []))
                        if pending:
                            _json("/queue", {"delete": [prompt_id]})
                        if not running and not pending:
                            break
                        time.sleep(1)
                    else:
                        raise RuntimeError("ComfyUI did not acknowledge interruption")
                except Exception:
                    self.process.kill()
                    key = _runtime_key(self.user_key, self.session_id)
                    runtime = dict(states.get(key) or {})
                    runtime["error"] = "ComfyUI could not be interrupted; worker stopped"
                    states[key] = runtime
            raise
        finally:
            ws.close()
            if prompt_id:
                try:
                    _json("/history", {"delete": [prompt_id]})
                except Exception:
                    pass  # Cleanup must not hide the original failure.

    @modal.enter(snap=True)
    def boot(self):
        """Create the reusable snapshot before any user session is billed."""
        self._boot_rejected = False
        self.snapshot_timings = {}
        try:
            boot_started = time.monotonic()
            stage_started = time.monotonic()
            _verify_models()
            self.snapshot_timings["model_verify_seconds"] = round(time.monotonic() - stage_started, 3)
            stage_started = time.monotonic()
            for folder in {Path(name).parts[0] for name in MODEL_FILES}:
                target = COMFY_ROOT / "models" / folder
                target.mkdir(parents=True, exist_ok=True)
                for name in MODEL_FILES:
                    if Path(name).parts[0] == folder:
                        link = target / Path(name).name
                        source = MODEL_ROOT / name
                        if link.exists() or link.is_symlink():
                            if link.resolve() == source:
                                continue
                            link.unlink()
                        link.symlink_to(source)
            self.snapshot_timings["model_link_seconds"] = round(time.monotonic() - stage_started, 3)
            comfy_env = os.environ.copy()
            comfy_env.update({
                "TORCH_CUDA_ARCH_LIST": "10.0;9.0;8.9",
                "CUDA_MODULE_LOADING": "LAZY",
                "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
                "NVIDIA_TF32_OVERRIDE": "1",
            })
            self.process = subprocess.Popen(COMFY_LAUNCH_ARGS, cwd=COMFY_ROOT, env=comfy_env)
            started = time.monotonic()
            while time.monotonic() - started < STARTUP_TIMEOUT:
                if not self._active():
                    raise RuntimeError("GPU session ended during model loading")
                if self.process.poll() is not None:
                    raise RuntimeError("ComfyUI exited during startup")
                try:
                    _json("/system_stats")
                    break
                except Exception:
                    time.sleep(2)
            else:
                raise TimeoutError("ComfyUI did not start")
            self.snapshot_timings["comfy_start_seconds"] = round(time.monotonic() - started, 3)
            stage_started = time.monotonic()
            self._run_graph(preload_workflow(), timeout=max(1, STARTUP_TIMEOUT - (time.monotonic() - started)),
                            enforce_active=False)
            self.snapshot_timings["base_model_preload_seconds"] = round(time.monotonic() - stage_started, 3)
            self.snapshot_timings["snapshot_build_seconds"] = round(time.monotonic() - boot_started, 3)
        except BaseException:
            _stop_process(getattr(self, "process", None))
            raise

    @modal.enter(snap=False)
    def activate(self):
        """Bind a restored warm worker to one paid user session."""
        self._boot_rejected = not ENABLE_GPU or not self._active()
        if self._boot_rejected:
            _stop_process(getattr(self, "process", None))
            return
        runtime_key = _runtime_key(self.user_key, self.session_id)
        runtime = {"allocated_at": time.time(), "startup_timings": dict(self.snapshot_timings)}
        states[runtime_key] = runtime
        started = time.monotonic()
        try:
            if self.process.poll() is not None:
                raise RuntimeError("Snapshotted ComfyUI process was not restored")
            _json("/system_stats", timeout=20)
            runtime["startup_timings"]["snapshot_restore_validation_seconds"] = round(
                time.monotonic() - started, 3)
            runtime["startup_timings"]["total_startup_seconds"] = runtime["startup_timings"][
                "snapshot_restore_validation_seconds"]
            runtime["ready_at"] = time.time()
            states[runtime_key] = runtime
        except BaseException as error:
            runtime["error"] = str(error)[:1200]
            runtime["failed_at"] = time.time()
            states[runtime_key] = runtime
            _stop_process(getattr(self, "process", None))
            raise

    @modal.exit()
    def shutdown(self):
        _stop_process(getattr(self, "process", None))

    @modal.method()
    def warmup(self):
        if getattr(self, "_boot_rejected", False) or not self._active():
            return {"status": "cancelled", "session_id": self.session_id}
        return {"status": "ready", "session_id": self.session_id}

    @modal.method()
    def generate(self, job_id, payload):
        if not self._active(job_id):
            return {"status": "cancelled", "jobId": job_id}
        started = time.monotonic()
        timings = {}
        image = COMFY_ROOT / "input" / (job_id + ".png")
        raw_image = image.with_suffix(".download")
        last_image = COMFY_ROOT / "input" / (job_id + "_last.png")
        raw_last_image = last_image.with_suffix(".download")
        output = COMFY_ROOT / "output" / (job_id + ".mp4")
        _put_job(self.user_key, job_id, status="running", phase="preparing", progress=3,
                 message="DOWNLOADING OPENING FRAME", started_at=time.time())
        try:
            from PIL import Image, ImageOps
            request = validate_request(payload)
            stage_started = time.monotonic()
            _download(request["image_url"], raw_image)
            if request.get("last_frame_url"):
                _download(request["last_frame_url"], raw_last_image)
            timings["input_download_seconds"] = round(time.monotonic() - stage_started, 3)
            _put_job(self.user_key, job_id, phase="preparing", progress=4,
                     message="CONVERTING OPENING FRAME")
            stage_started = time.monotonic()
            with Image.open(raw_image) as source:
                fitted = ImageOps.fit(
                    source.convert("RGB"),
                    (request["sample_width"], request["sample_height"]),
                    method=Image.Resampling.LANCZOS,
                )
                fitted.save(image)
            last_image_name = None
            if request.get("last_frame_url"):
                with Image.open(raw_last_image) as source:
                    fitted_last = ImageOps.fit(
                        source.convert("RGB"),
                        (request["sample_width"], request["sample_height"]),
                        method=Image.Resampling.LANCZOS,
                    )
                    fitted_last.save(last_image)
                last_image_name = last_image.name
            timings["input_convert_seconds"] = round(time.monotonic() - stage_started, 3)
            graph = build_workflow(request, image.name, job_id, last_image_name=last_image_name)
            _put_job(self.user_key, job_id, phase="conditioning", progress=5,
                     message="SUBMITTING LTX-2.5 WORKFLOW")
            stage_started = time.monotonic()
            graph_node_timings = {}
            self._run_graph(graph, job=job_id, node_timings=graph_node_timings)
            timings["generation_seconds"] = round(time.monotonic() - stage_started, 3)
            timings["graph_node_seconds"] = graph_node_timings
            if not self._active(job_id):
                raise RuntimeError("Generation was cancelled")
            _put_job(self.user_key, job_id, phase="verifying", progress=93, message="VERIFYING PLAYABLE VIDEO")
            stage_started = time.monotonic()
            media = _probe_video(output, request)
            timings["verification_seconds"] = round(time.monotonic() - stage_started, 3)
            if not self._active(job_id):
                raise RuntimeError("Generation was cancelled before upload")
            _put_job(self.user_key, job_id, phase="uploading", progress=97, message="UPLOADING VIDEO")
            stage_started = time.monotonic()
            upload = urllib.request.Request(_public_url(str(payload["upload_url"])), data=output.read_bytes(),
                                            method="PUT", headers={"Content-Type": "video/mp4"})
            with urllib.request.urlopen(upload, timeout=120) as response:
                if response.status not in {200, 201, 204}:
                    raise RuntimeError("Video upload failed")
            timings["upload_seconds"] = round(time.monotonic() - stage_started, 3)
            # Verify the object can be fetched before reporting success to EditStory.
            # Preserve the existing S3 ACL. Use a signed GET, not an unsigned HEAD.
            delivery_request = urllib.request.Request(_public_url(str(payload["verify_url"])),
                                                       headers={"Range": "bytes=0-0"})
            stage_started = time.monotonic()
            with urllib.request.urlopen(delivery_request, timeout=30) as response:
                size = response.headers.get("Content-Range", "").rsplit("/", 1)[-1] if response.status == 206 else response.headers.get("Content-Length", "0")
                if int(size) != output.stat().st_size or not response.read(1):
                    raise RuntimeError("Delivered video size does not match the uploaded MP4")
            timings["delivery_verify_seconds"] = round(time.monotonic() - stage_started, 3)
            timings["total_job_seconds"] = round(time.monotonic() - started, 3)
            result = {"status": "succeeded", "jobId": job_id, "phase": "completed", "progress": 100,
                      "message": "VIDEO READY", "videoUrl": payload["video_url"], "media": media,
                      "resolution": request["resolution"], "timings": timings,
                      "generation_seconds": timings["generation_seconds"], "completed_at": time.time()}
            return _put_job(self.user_key, job_id, **result)
        except Exception as error:
            return _put_job(self.user_key, job_id, status="failed", phase="failed", progress=0,
                            message="VIDEO GENERATION FAILED", error=str(error)[:1200], completed_at=time.time())
        finally:
            for path in (image, raw_image, last_image, raw_last_image, output):
                path.unlink(missing_ok=True)


def _session(user, value):
    return LTXSession(user_key=user, session_id=value["session_id"])


def _call_is_active(call_id):
    if not call_id:
        return False
    try:
        modal.FunctionCall.from_id(str(call_id)).get(timeout=0)
        return False
    except TimeoutError:
        return True
    except Exception:
        return False


def _release(user, value, reason):
    value.update(status="stopping", stop_reason=reason)
    value.setdefault("shutdown_requested_at", time.time())
    states[_key(user)] = value  # Revoke before cancelling the worker.
    for job in _jobs(user, value):
        if job.get("status") in {"queued", "running"}:
            _cancel_job(user, job["jobId"], reason)
    value["active_jobs"] = 0
    value["last_activity_at"] = time.time()
    worker = _session(user, value)
    pool_disabled = False
    errors = []
    try:
        worker.update_autoscaler(min_containers=0, max_containers=0, scaledown_window=2)
        pool_disabled = True
    except Exception as error:
        errors.append(f"Pool disable: {str(error)[:300]}")
    for call_id in value.get("call_ids", []):
        try:
            modal.FunctionCall.from_id(call_id).cancel(terminate_containers=True)
        except Exception as error:
            errors.append(f"Call cancellation: {str(error)[:300]}")
    if errors:
        value["error"] = "Shutdown error: " + "; ".join(errors)
    runners = None
    try:
        runners = worker.get_current_stats().num_total_runners
    except Exception:
        pass
    active_call = any(_call_is_active(call_id) for call_id in value.get("call_ids", []))
    stale_stop = time.time() - float(value.get("shutdown_requested_at") or time.time()) >= 30
    if (pool_disabled and runners == 0) or (runners == 0 and not active_call) or (stale_stop and not active_call and not value.get("active_jobs")):
        value.update(status="off", paid_remaining_seconds=paid_remaining(value, time.time()),
                     paid_deadline_at=None, stopped_at=time.time(), active_jobs=0,
                     call_ids=[], shutdown_requested_at=None)
    return value


@app.function(image=control_image, cpu=0.5, memory=512, timeout=180,
              max_containers=1, volumes={"/models": model_volume})
@modal.concurrent(max_inputs=50)
@_serialize_user_control
def manage(user, action, payload=None):
    """One serialized control writer, also used by the idle/expiry sweeper."""
    _key(user)
    payload = payload or {}
    value = _snapshot(user)
    if action == "start":
        print(f"[ModalGPU][manage-start] user={user[:12]} prior_status={value.get('status')} "
              f"calls={len(value.get('call_ids', []))} paid_pending={value.get('paid_balance_pending')}", flush=True)
    now = time.time()
    if value.get("status") in {"starting", "ready", "stopping"} and not value.get("session_id"):
        raise ValueError("Legacy LTX session state exists; drain it before the LTX v2 cutover")
    if value.get("status") == "starting" and value.get("call_ids"):
        try:
            result = modal.FunctionCall.from_id(value["call_ids"][0]).get(timeout=0)
            if not isinstance(result, dict) or result.get("status") != "ready":
                value = _release(user, value, "LTX startup ended without a ready worker")
        except TimeoutError:
            pass  # Warmup is still running, including ordinary capacity waiting.
        except Exception as error:
            value["error"] = str(error)[:1000]
            value = _release(user, value, "LTX startup failed")
    # Reconcile worker crashes without turning arbitrary returned dicts into success.
    for job in _jobs(user, value):
        if job.get("status") in {"queued", "running"} and job.get("call_id"):
            try:
                result = modal.FunctionCall.from_id(job["call_id"]).get(timeout=0)
                latest = _job(user, job["jobId"])
                if latest.get("status") in {"queued", "running"}:
                    _put_job(user, job["jobId"], status="failed", phase="failed",
                             error="Worker ended without a verified, uploaded video", completed_at=now)
            except TimeoutError:
                pass
            except Exception as error:
                _put_job(user, job["jobId"], status="failed", phase="failed", error=str(error)[:1000], completed_at=now)
    jobs = _jobs(user, value)
    value["active_jobs"] = sum(j.get("status") in {"queued", "running"} for j in jobs)
    value["last_activity_at"] = max([float(value.get("last_activity_at") or 0)] +
                                     [float(j.get("completed_at") or 0) for j in jobs])
    if value.get("status") in {"starting", "ready"} and value.get("session_id"):
        if paid_remaining(value, now) <= 0:
            value = _release(user, value, "GPU time ended · releasing B300")
        elif value.get("status") == "ready" and not value.get("active_jobs") and now - value.get("last_activity_at", now) >= IDLE_TIMEOUT:
            value = _release(user, value, "Idle timeout · releasing B300")
    if value.get("status") == "stopping" and value.get("session_id"):
        value = _release(user, value, value.get("stop_reason", "Releasing B300"))
    states[_key(user)] = value

    if action == "start":
        if value.get("status") in {"starting", "ready", "stopping"}:
            return _response(user, value)
        if not ENABLE_GPU:
            raise ValueError("GPU starts are disabled until the approved spending-capped test")
        if value.get("paid_balance_pending"):
            raise ValueError("Settle the previous GPU session before starting another")
        model_volume.reload()
        print(f"[ModalGPU][manage-start] user={user[:12]} stage=verify-models", flush=True)
        _verify_models()
        seconds = int(payload.get("paid_seconds") or 0)
        if seconds <= 0:
            raise ValueError("Add GPU time before starting")
        value = {"status": "starting", "session_id": uuid.uuid4().hex, "started_at": now,
                 "last_activity_at": now, "paid_remaining_seconds": seconds,
                 "paid_deadline_at": None, "billing_started_at": None, "paid_balance_pending": True,
                 "job_ids": [], "call_ids": []}
        states[_key(user)] = value
        try:
            print(f"[ModalGPU][manage-start] user={user[:12]} stage=spawn-warmup paid_seconds={seconds}", flush=True)
            call = _session(user, value).warmup.spawn()
            value["call_ids"].append(call.object_id)
            print(f"[ModalGPU][manage-start] user={user[:12]} stage=spawned call={call.object_id}", flush=True)
        except Exception as error:
            print(f"[ModalGPU][manage-start] user={user[:12]} stage=spawn-failed error={type(error).__name__}:{str(error)[:300]}", flush=True)
            value = _release(user, _snapshot(user), "GPU startup submission failed")
            states[_key(user)] = value
            raise
    elif action == "stop":
        if value.get("status") not in {"off", "error"}:
            value = _release(user, value, "Releasing B300")
    elif action == "extend-time":
        seconds = int(payload.get("added_seconds") or 0)
        if seconds <= 0 or value.get("status") not in {"starting", "ready"}:
            raise ValueError("Time can only be added to an active GPU session")
        if value.get("paid_deadline_at") is not None:
            value["paid_deadline_at"] = max(now, value["paid_deadline_at"]) + seconds
        else:
            value["paid_remaining_seconds"] += seconds
    elif action == "ack-time":
        if value.get("status") not in {"off", "error"} or payload.get("session_id") != value.get("session_id"):
            raise ValueError("Only this session's confirmed final balance can be settled")
        value.update(paid_balance_pending=False, paid_remaining_seconds=None, paid_deadline_at=None)
    elif action == "generate":
        if value.get("status") != "ready":
            raise ValueError("Start the LTX-2.5 GPU and wait until it is ready")
        validate_request(payload)
        for field in ("upload_url", "video_url", "verify_url"):
            _public_url(str(payload.get(field, "")))
        scene = str(payload.get("scene_key") or "")
        if not scene or len(scene) > 160:
            raise ValueError("A stable scene key is required")
        for job in _jobs(user, value):
            if job.get("scene_key") == scene and job.get("status") in {"queued", "running"}:
                prior_status = job.get("status")
                _cancel_job(user, job["jobId"], "REPLACED BY NEW VIDEO FOR THIS SCENE")
                # A running graph must reach _run_graph's cooperative cleanup so
                # its exact Comfy prompt is deleted/interrupted before the new
                # scene version samples. Only a still-queued Modal input is safe
                # to cancel immediately.
                if prior_status == "queued" and job.get("call_id"):
                    try:
                        modal.FunctionCall.from_id(job["call_id"]).cancel(terminate_containers=False)
                    except Exception:
                        pass
        # A running job notices cancellation and interrupts Comfy. A queued call is
        # cancelled immediately so redo cannot leave an old scene waiting behind it.
        job_id = uuid.uuid4().hex
        job = {"jobId": job_id, "status": "queued", "phase": "queued", "progress": 1,
               "message": "VIDEO QUEUED", "scene_key": scene, "session_id": value["session_id"], "created_at": now}
        states[_job_key(user, job_id)] = job
        value["job_ids"].append(job_id)
        value["last_activity_at"] = now
        states[_key(user)] = value
        try:
            call = _session(user, value).generate.spawn(job_id, payload)
            latest = _get(user)
            if latest.get("session_id") != value.get("session_id") or latest.get("status") != "ready":
                try:
                    call.cancel(terminate_containers=True)
                finally:
                    _cancel_job(user, job_id, latest.get("stop_reason", "GPU session stopped before video generation started"))
                return _job(user, job_id)
            value = latest
            value["call_ids"].append(call.object_id)
            _put_job(user, job_id, call_id=call.object_id)
        except Exception as error:
            _put_job(user, job_id, status="failed", phase="failed", error=str(error)[:500], completed_at=time.time())
            raise
        states[_key(user)] = value
        return job
    elif action == "generation-status":
        job_id = str(payload.get("job_id") or "")
        job = _job(user, job_id)
        if not job:
            raise ValueError("Video job not found")
        queue = [j for j in _jobs(user, value) if j.get("status") == "queued"]
        if job.get("status") == "queued":
            position = next((i + 1 for i, j in enumerate(queue) if j.get("jobId") == job_id), 0)
            job.update(queue_position=position, message="VIDEO QUEUED · NEXT" if position == 1 else f"VIDEO QUEUED · {max(0, position - 1)} AHEAD")
        return {key: item for key, item in {**job, "active_jobs": value.get("active_jobs", 0)}.items() if key != "call_id"}
    elif action not in {"status", "sweep"}:
        raise ValueError("Unknown GPU control action")
    states[_key(user)] = value
    return _response(user, value)


@app.function(image=control_image, cpu=0.25, memory=256, timeout=180,
              schedule=modal.Period(seconds=30))
def reap_idle_sessions():
    for key, value in states.items():
        if isinstance(key, str) and key.startswith("user:") and isinstance(value, dict) and value.get("status") in {"starting", "ready", "stopping"}:
            # Resolve the currently deployed function instead of retaining a
            # serialized handle across deployments.
            _current_manage().remote(key[5:], "sweep")


def _current_manage():
    """Resolve manage from the active deployment, safe across redeploys."""
    return modal.Function.from_name(APP_NAME, "manage")


@app.function(image=control_image, cpu=0.5, memory=512, timeout=180)
@modal.asgi_app(requires_proxy_auth=True)
def control():
    from fastapi import FastAPI, HTTPException
    api = FastAPI(docs_url=None, redoc_url=None)

    @api.post("/{action}")
    def post(action: str, body: dict):
        try:
            if action == "start":
                print(f"[ModalGPU][control-start] user={str(body.get('user_key') or '')[:12]} received", flush=True)
            # ASGI containers can survive a redeploy. Looking up by deployed
            # name prevents an old container from calling an invalid function
            # handle from the previous deployment.
            return _current_manage().remote(str(body.get("user_key") or ""), action, body)
        except ValueError as error:
            if action == "start":
                print(f"[ModalGPU][control-start] rejected={str(error)[:300]}", flush=True)
            raise HTTPException(409, str(error)) from error

    @api.get("/{action}")
    def get(action: str, user_key: str, job_id: str = ""):
        if action not in {"status", "generation-status"}:
            raise HTTPException(404)
        try:
            return _current_manage().remote(user_key, action, {"job_id": job_id})
        except ValueError as error:
            raise HTTPException(409, str(error)) from error

    return api
