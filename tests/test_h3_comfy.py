"""Offline contract tests. Fake Modal cannot allocate resources or use network."""

import copy
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from modal_apps.h3_comfy_workflow import build_workflow, validate_request


class MemoryDict(dict):
    def get(self, key, default=None):
        return copy.deepcopy(super().get(key, default))

    def __setitem__(self, key, value):
        super().__setitem__(key, copy.deepcopy(value))


class FakeImage:
    def __getattr__(self, _name):
        return lambda *a, **kw: self


class FakeApp:
    def __init__(self, *a, **kw):
        pass

    def __getattr__(self, _name):
        return lambda *a, **kw: lambda function: function


def load_service():
    image = FakeImage()
    module = types.SimpleNamespace(
        App=FakeApp, Image=image, Secret=image, Volume=image,
        Dict=types.SimpleNamespace(from_name=lambda *a, **kw: MemoryDict()),
        Period=lambda **kw: None, parameter=lambda: "",
        concurrent=lambda **kw: lambda f: f,
        enter=lambda: lambda f: f, exit=lambda: lambda f: f,
        method=lambda: lambda f: f, asgi_app=lambda **kw: lambda f: f,
        Function=types.SimpleNamespace(from_name=lambda *a, **kw: None),
        FunctionCall=types.SimpleNamespace(from_id=lambda _: None))
    spec = importlib.util.spec_from_file_location("h3_service_under_test", ROOT / "modal_apps/h3_comfy_b300.py")
    service = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"modal": module}):
        spec.loader.exec_module(service)
    return service


class ControlRoutingTests(unittest.TestCase):
    def test_manage_lookup_resolves_current_deployed_function(self):
        service = load_service()
        current_manage = object()
        lookups = []

        def from_name(app_name, function_name):
            lookups.append((app_name, function_name))
            return current_manage

        service.modal.Function.from_name = from_name
        self.assertIs(service._current_manage(), current_manage)
        self.assertEqual(lookups, [(service.APP_NAME, "manage")])


class FakeCall:
    def __init__(self, object_id):
        self.object_id = object_id
        self.result = None
        self.error = None
        self.cancelled = False

    def get(self, timeout=0):
        if self.error:
            raise self.error
        if self.result is None:
            raise TimeoutError()
        return self.result

    def cancel(self, **kwargs):
        self.cancelled = True


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.s = load_service()
        self.s.ENABLE_GPU = True
        self.s._verify_models = lambda **kw: None
        self.s._public_url = lambda url: url
        self.worker_class = self.s.H3Session
        self.now = 1000.0
        self.clock = patch.object(self.s.time, "time", lambda: self.now)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        self.calls = {}
        self.runners = 1
        self.pool_changes = []

        def spawn(*args):
            call = FakeCall(str(len(self.calls) + 1))
            self.calls[call.object_id] = call
            return call

        worker = types.SimpleNamespace(
            warmup=types.SimpleNamespace(spawn=spawn), generate=types.SimpleNamespace(spawn=spawn),
            update_autoscaler=lambda **kw: self.pool_changes.append(kw),
            get_current_stats=lambda: types.SimpleNamespace(num_total_runners=self.runners))
        self.s.H3Session = lambda **kw: worker
        self.s.modal.FunctionCall.from_id = lambda ident: self.calls[ident]

    def start(self, seconds=600):
        return self.s.manage("user", "start", {"paid_seconds": seconds})

    def allocated(self, ready=False):
        value = self.s._get("user")
        runtime = {"allocated_at": self.now}
        if ready:
            runtime["ready_at"] = self.now
            self.calls[value["call_ids"][0]].result = {"status": "ready"}
        self.s.states[self.s._runtime_key("user", value["session_id"])] = runtime

    def generate(self, scene):
        return self.s.manage("user", "generate", {
            "prompt": "The camera moves gently", "image_url": "https://media.example/open.png",
            "upload_url": "https://media.example/upload", "video_url": "https://media.example/video.mp4",
            "verify_url": "https://media.example/verify",
            "scene_key": scene, "duration": 5})

    def test_capacity_wait_loading_ready_and_topup_use_one_deadline(self):
        self.start()
        self.now += 60
        waiting = self.s.manage("user", "status")
        self.assertEqual(waiting["paid_remaining_seconds"], 600)
        self.assertFalse(waiting["billing_active"])
        self.allocated()
        self.now += 90
        loading = self.s.manage("user", "status")
        self.assertEqual(loading["paid_remaining_seconds"], 510)
        self.assertTrue(loading["billing_active"])
        self.assertEqual(loading["stage"], "loading_model")
        key = self.s._runtime_key("user", loading["session_id"])
        runtime = self.s.states.get(key)
        runtime["ready_at"] = self.now
        self.s.states[key] = runtime
        ready = self.s.manage("user", "status")
        self.assertEqual(ready["paid_deadline_at"], loading["paid_deadline_at"])
        self.assertEqual(ready["paid_remaining_seconds"], 510)
        extended = self.s.manage("user", "extend-time", {"added_seconds": 1800})
        self.assertEqual(extended["paid_remaining_seconds"], 2310)

    def test_topup_before_first_poll_does_not_lose_allocated_loading(self):
        self.start()
        self.allocated()
        self.now += 120
        extended = self.s.manage("user", "extend-time", {"added_seconds": 600})
        self.assertEqual(extended["paid_remaining_seconds"], 1080)

    def test_stop_while_loading_counts_until_confirmed_release_then_settles_once(self):
        self.start()
        self.allocated()
        self.now += 80
        stopping = self.s.manage("user", "stop")
        self.assertEqual(stopping["status"], "stopping")
        self.assertEqual(stopping["paid_remaining_seconds"], 520)
        with self.assertRaises(ValueError):
            self.s.manage("user", "ack-time", {"session_id": stopping["session_id"]})
        self.now += 5
        self.runners = 0
        stopped = self.s.manage("user", "status")
        self.assertEqual(stopped["status"], "off")
        self.assertEqual(stopped["paid_remaining_seconds"], 515)
        self.s.manage("user", "ack-time", {"session_id": stopped["session_id"]})
        self.now += 50
        self.assertIsNone(self.s.manage("user", "status")["paid_remaining_seconds"])

    def test_duplicate_start_does_not_spawn_second_worker(self):
        first = self.start()
        second = self.start()
        self.assertEqual(first["session_id"], second["session_id"])
        self.assertEqual(len(self.calls), 1)

    def test_disabled_start_never_spawns(self):
        self.s.ENABLE_GPU = False
        with self.assertRaises(ValueError):
            self.start()
        self.assertEqual(self.calls, {})

    def test_expiry_during_loading_releases_without_becoming_ready(self):
        self.start(60)
        self.allocated()
        self.now += 61
        expired = self.s.manage("user", "sweep")
        self.assertEqual(expired["status"], "stopping")
        self.assertEqual(expired["paid_remaining_seconds"], 0)
        self.assertTrue(self.calls["1"].cancelled)

    def test_startup_crash_is_reported_and_loading_is_not_refunded(self):
        self.start()
        self.allocated()
        self.now += 45
        self.calls["1"].error = RuntimeError("model failed")
        self.runners = 0
        state = self.s.manage("user", "status")
        self.assertEqual(state["status"], "off")
        self.assertEqual(state["paid_remaining_seconds"], 555)
        self.assertIn("model failed", state["error"])

    def test_scene_replacement_cannot_revive_cancelled_job_or_cancel_other_scene(self):
        self.start()
        self.allocated(ready=True)
        first = self.generate("scene-A")
        other = self.generate("scene-B")
        replacement = self.generate("scene-A")
        # Simulate an already in-flight worker write racing cancellation.
        self.s.states[self.s._job_key("user", first["jobId"])] = {
            **first, "status": "succeeded", "videoUrl": "https://stale.example/video.mp4"}
        cancelled = self.s.manage("user", "generation-status", {"job_id": first["jobId"]})
        self.assertEqual(cancelled["status"], "cancelled")
        other_status = self.s.manage("user", "generation-status", {"job_id": other["jobId"]})
        new_status = self.s.manage("user", "generation-status", {"job_id": replacement["jobId"]})
        self.assertEqual(other_status["queue_position"], 1)
        self.assertEqual(new_status["queue_position"], 2)
        self.assertTrue(self.calls["2"].cancelled)
        self.assertFalse(self.calls["3"].cancelled)
        self.assertFalse(self.calls["4"].cancelled)

    def test_worker_dict_without_verified_delivery_is_not_success(self):
        self.start()
        self.allocated(ready=True)
        job = self.generate("scene-A")
        self.calls["2"].result = {"status": "cancelled"}
        result = self.s.manage("user", "generation-status", {"job_id": job["jobId"]})
        self.assertEqual(result["status"], "failed")
        self.assertNotIn("videoUrl", result)

    def test_old_session_cannot_settle_new_balance(self):
        first = self.start()
        self.runners = 0
        self.s.manage("user", "stop")
        self.s.manage("user", "ack-time", {"session_id": first["session_id"]})
        self.start()
        with self.assertRaises(ValueError):
            self.s.manage("user", "ack-time", {"session_id": first["session_id"]})

    def test_unknown_runner_count_is_not_a_free_off_state(self):
        self.start()
        self.allocated()
        worker = self.s.H3Session()
        def unavailable():
            raise RuntimeError("stats unavailable")
        worker.get_current_stats = unavailable
        self.now += 20
        state = self.s.manage("user", "stop")
        self.assertEqual(state["status"], "stopping")
        self.assertTrue(state["billing_active"])
        self.now += 5
        self.assertEqual(self.s.manage("user", "status")["paid_remaining_seconds"], 575)

    def test_expired_session_cancels_all_queued_scenes(self):
        self.start(60)
        self.allocated(ready=True)
        first, second = self.generate("scene-A"), self.generate("scene-B")
        self.now += 61
        self.s.manage("user", "sweep")
        for job in (first, second):
            state = self.s.manage("user", "generation-status", {"job_id": job["jobId"]})
            self.assertEqual(state["status"], "cancelled")

    def test_shutdown_cancels_running_and_every_queued_call_and_rejects_late_success(self):
        started = self.start()
        self.allocated(ready=True)
        jobs = [self.generate(scene) for scene in ("scene-A", "scene-B", "scene-C")]
        self.s._put_job("user", jobs[0]["jobId"], status="running")
        state = self.s.manage("user", "stop")
        self.assertEqual(state["status"], "stopping")
        self.assertEqual(state["active_jobs"], 0)
        self.assertTrue(all(call.cancelled for call in self.calls.values()))
        self.assertEqual(self.pool_changes[-1]["max_containers"], 0)
        worker = self.worker_class()
        worker.user_key, worker.session_id = "user", started["session_id"]
        for job in jobs:
            self.assertFalse(worker._active(job["jobId"]))
            late = self.s._put_job("user", job["jobId"], status="succeeded", videoUrl="https://late.example/result.mp4")
            self.assertEqual(late["status"], "cancelled")
        with self.assertRaises(ValueError):
            self.generate("scene-D")

    def test_stop_race_after_spawn_cancels_new_call_and_does_not_restore_ready(self):
        self.start()
        self.allocated(ready=True)
        original_session = self.s.H3Session()
        original_spawn = original_session.generate.spawn

        def racing_spawn(*args):
            call = original_spawn(*args)
            self.s.manage("user", "stop")
            return call

        original_session.generate.spawn = racing_spawn
        job = self.generate("scene-A")
        self.assertEqual(job["status"], "cancelled")
        self.assertTrue(self.calls["2"].cancelled)
        self.assertEqual(self.s._get("user")["status"], "stopping")

    def test_pool_control_failure_still_cancels_all_calls_and_does_not_claim_off(self):
        self.start()
        self.allocated(ready=True)
        self.generate("scene-A")
        self.generate("scene-B")
        def fail_pool(**kwargs):
            raise RuntimeError("pool control temporarily unavailable")
        self.s.H3Session().update_autoscaler = fail_pool
        self.runners = 0
        state = self.s.manage("user", "stop")
        self.assertTrue(all(call.cancelled for call in self.calls.values()))
        self.assertEqual(state["status"], "stopping")
        self.assertIn("Pool disable", state["error"])

    def test_one_failed_call_cancellation_does_not_skip_other_jobs(self):
        self.start()
        self.allocated(ready=True)
        self.generate("scene-A")
        self.generate("scene-B")
        def fail_cancel(**kwargs):
            raise RuntimeError("one cancellation failed")
        self.calls["2"].cancel = fail_cancel
        state = self.s.manage("user", "stop")
        self.assertTrue(self.calls["1"].cancelled)
        self.assertTrue(self.calls["3"].cancelled)
        self.assertEqual(state["status"], "stopping")
        self.assertIn("Call cancellation", state["error"])

    def test_replacement_interrupts_comfy_prompt_without_restarting_shared_gpu(self):
        started = self.start()
        self.allocated(ready=True)
        old = self.generate("scene-A")
        other = self.generate("scene-B")
        self.s._put_job("user", old["jobId"], status="running")
        worker = self.worker_class()
        worker.user_key, worker.session_id = "user", started["session_id"]
        killed = []
        worker.process = types.SimpleNamespace(poll=lambda: None, kill=lambda: killed.append(True))
        requests = []
        running = {"value": True}
        def comfy(path, body=None):
            requests.append((path, body))
            if path == "/prompt":
                return {"prompt_id": "old-prompt"}
            if path == "/queue" and body is None:
                return {"queue_running": [[0, "old-prompt"]] if running["value"] else [],
                        "queue_pending": []}
            if path == "/interrupt":
                running["value"] = False
            return {}
        def receive():
            self.generate("scene-A")
            return json.dumps({"type": "status", "data": {}})
        ws = types.SimpleNamespace(recv=receive, close=lambda: None)
        fake_ws = types.SimpleNamespace(create_connection=lambda *a, **kw: ws, WebSocketTimeoutException=TimeoutError)
        with patch.dict(sys.modules, {"websocket": fake_ws}), patch.object(self.s, "_json", comfy):
            with self.assertRaisesRegex(RuntimeError, "cancelled"):
                worker._run_graph({}, job=old["jobId"])
        self.assertIn(("/interrupt", {}), requests)
        self.assertNotIn(("/queue", {"delete": ["old-prompt"]}), requests)
        self.assertFalse(self.calls["2"].cancelled)
        self.assertEqual(killed, [])
        self.assertEqual(self.pool_changes, [])
        self.assertEqual(self.s._job("user", other["jobId"])["status"], "queued")

    def test_cancelling_pending_prompt_never_interrupts_running_other_scene(self):
        started = self.start()
        self.allocated(ready=True)
        pending = self.generate("scene-B")
        worker = self.worker_class()
        worker.user_key, worker.session_id = "user", started["session_id"]
        worker.process = types.SimpleNamespace(poll=lambda: None, kill=lambda: None)
        requests = []
        queue_pending = {"value": True}

        def comfy(path, body=None):
            requests.append((path, body))
            if path == "/prompt":
                return {"prompt_id": "pending-prompt"}
            if path == "/queue" and body is None:
                return {"queue_running": [[0, "different-running-prompt"]],
                        "queue_pending": [[1, "pending-prompt"]] if queue_pending["value"] else []}
            if path == "/queue" and body == {"delete": ["pending-prompt"]}:
                queue_pending["value"] = False
            return {}

        def receive():
            self.s._cancel_job("user", pending["jobId"], "REPLACED")
            return json.dumps({"type": "status", "data": {}})

        ws = types.SimpleNamespace(recv=receive, close=lambda: None)
        fake_ws = types.SimpleNamespace(create_connection=lambda *a, **kw: ws,
                                         WebSocketTimeoutException=TimeoutError)
        with patch.dict(sys.modules, {"websocket": fake_ws}), patch.object(self.s, "_json", comfy):
            with self.assertRaisesRegex(RuntimeError, "cancelled"):
                worker._run_graph({}, job=pending["jobId"])

        self.assertIn(("/queue", {"delete": ["pending-prompt"]}), requests)
        self.assertNotIn(("/interrupt", {}), requests)

    def test_history_http_timeout_is_a_missed_poll_not_a_failed_graph(self):
        started = self.start()
        self.allocated(ready=True)
        worker = self.worker_class()
        worker.user_key, worker.session_id = "user", started["session_id"]
        worker.process = types.SimpleNamespace(poll=lambda: None)
        history_polls = {"count": 0}

        def comfy(path, body=None):
            if path == "/prompt":
                return {"prompt_id": "preload-prompt"}
            if path == "/history/preload-prompt":
                history_polls["count"] += 1
                if history_polls["count"] == 1:
                    raise TimeoutError("local Comfy HTTP busy")
                return {"preload-prompt": {"status": {"completed": True}}}
            return {}

        ws = types.SimpleNamespace(recv=lambda: (_ for _ in ()).throw(TimeoutError()), close=lambda: None)
        fake_ws = types.SimpleNamespace(create_connection=lambda *a, **kw: ws,
                                         WebSocketTimeoutException=TimeoutError)
        with patch.dict(sys.modules, {"websocket": fake_ws}), patch.object(self.s, "_json", comfy):
            result = worker._run_graph({}, timeout=30)
        self.assertTrue(result["status"]["completed"])
        self.assertEqual(history_polls["count"], 2)

    def test_late_inactive_boot_finishes_without_enter_crash_loop(self):
        worker = self.worker_class()
        worker.user_key, worker.session_id = "user", "old-session"
        worker.boot()
        self.assertEqual(worker.warmup()["status"], "cancelled")


class WorkflowTests(unittest.TestCase):
    def request(self, **overrides):
        return validate_request({"prompt": "Walk forwards", "image_url": "https://media.example/image.png", **overrides})

    def test_comfy_launch_does_not_force_pytorch_cross_attention(self):
        service = load_service()
        self.assertNotIn("--use-pytorch-cross-attention", service.COMFY_LAUNCH_ARGS)
        self.assertIn("--gpu-only", service.COMFY_LAUNCH_ARGS)
        self.assertIn("--preview-method", service.COMFY_LAUNCH_ARGS)

    def test_worker_accepts_delivery_overlap_without_parallel_gpu_workers(self):
        source = (ROOT / "modal_apps/h3_comfy_b300.py").read_text(encoding="utf-8")
        self.assertIn("@modal.concurrent(max_inputs=2)\nclass H3Session", source)
        self.assertIn("max_containers=1", source)

    def test_fl2va_first_frame_audio_four_steps_and_native_480p_are_wired(self):
        graph = build_workflow(self.request(), "frame.png", "a" * 32)
        self.assertEqual(graph["condition"]["class_type"], "MiniMaxH3ImageToVideo")
        self.assertEqual(graph["condition"]["inputs"]["first_frame"], ["image", 0])
        self.assertEqual(graph["condition"]["inputs"]["length"], 124)
        self.assertEqual(graph["lora"]["class_type"], "LoraLoaderModelOnly")
        self.assertEqual(graph["shift"]["class_type"], "MiniMaxH3SigmaShift")
        self.assertEqual(graph["shift"]["inputs"]["shift_video"], 6.0)
        self.assertEqual(graph["shift"]["inputs"]["shift_audio"], 3.0)
        self.assertEqual(graph["cache"]["inputs"]["model"], ["shift", 0])
        self.assertEqual(graph["sampler"]["inputs"]["sampler_name"], "euler")
        self.assertEqual(graph["schedule"]["inputs"]["steps"], 4)
        self.assertEqual(graph["condition"]["inputs"]["width"], 832)
        self.assertEqual(graph["condition"]["inputs"]["height"], 480)
        self.assertNotIn("latent_upscale", graph)
        self.assertEqual(graph["audio"]["inputs"]["samples"], ["sample", 0])
        self.assertEqual(graph["save"]["inputs"]["audio"], ["audio", 0])

    def test_384p_is_native_and_skips_latent_upscale(self):
        request = self.request(resolution="384p")
        graph = build_workflow(request, "frame.png", "a" * 32)
        self.assertEqual((request["width"], request["height"]), (672, 384))
        self.assertEqual((request["sample_width"], request["sample_height"]), (672, 384))
        self.assertNotIn("latent_upscale", graph)
        self.assertEqual(graph["video"]["inputs"]["samples"], ["sample", 0])

    def test_speed_nodes_are_current_int8_compatible_path(self):
        graph = build_workflow(self.request(), "image.png", "a" * 32)
        self.assertEqual(graph["cache"]["class_type"], "ApplyMiniMaxH3FirstBlockCache")
        self.assertEqual(graph["schedule"]["inputs"]["model"], ["cache", 0])
        self.assertEqual(graph["guider"]["inputs"]["model"], ["cache", 0])
        self.assertFalse(any(node["class_type"] in {
            "EasyCache", "SolAttnPatch", "PathchSageAttentionKJ"
        } for node in graph.values()))

    def test_all_native_resolution_graphs_have_no_dangling_links(self):
        for resolution in ("384p", "480p", "720p"):
            graph = build_workflow(self.request(resolution=resolution), "frame.png", "a" * 32)
            for node_id, node in graph.items():
                for value in node["inputs"].values():
                    if isinstance(value, list) and len(value) == 2 and isinstance(value[0], str):
                        self.assertIn(value[0], graph, f"{resolution} {node_id} links to missing {value[0]}")

    def test_cost_bounds_and_portrait_dimensions(self):
        for duration in [0, 16, float("nan"), float("inf")]:
            with self.assertRaises(ValueError):
                self.request(duration=duration)
        request = self.request(duration=15, aspect_ratio="9:16", width=10000, height=10000)
        self.assertEqual((request["width"], request["height"], request["frames"]), (480, 832, 362))
        self.assertEqual((request["sample_width"], request["sample_height"]), (480, 832))
        native_720 = self.request(resolution="720p", aspect_ratio="16:9")
        self.assertEqual((native_720["sample_width"], native_720["sample_height"]), (1344, 768))
        with self.assertRaises(ValueError):
            self.request(resolution="1080p")
        with self.assertRaises(ValueError):
            self.request(image_url="")

    def test_video_verification_rejects_missing_audio_and_wrong_duration(self):
        service = load_service()
        request = self.request()
        info = {"streams": [{"codec_type": "video", "codec_name": "h264", "width": 832, "height": 480}],
                "format": {"duration": str(124 / 24)}}
        with patch.object(service.subprocess, "check_output", lambda *a, **kw: json.dumps(info)):
            with self.assertRaisesRegex(RuntimeError, "audio"):
                service._probe_video(Path("video.mp4"), request)
            info["streams"].append({"codec_type": "audio", "codec_name": "aac"})
            info["format"]["duration"] = "0.1"
            with self.assertRaisesRegex(RuntimeError, "duration"):
                service._probe_video(Path("video.mp4"), request)
            info["format"]["duration"] = str(124 / 24)
            with patch.object(service.subprocess, "run") as decoder:
                self.assertTrue(service._probe_video(Path("video.mp4"), request)["decoded"])
                self.assertIn("-xerror", decoder.call_args.args[0])

    def test_fl2va_two_frame_conditioning_wired_when_last_frame_provided(self):
        request = self.request(last_frame_url="https://media.example/end.png")
        self.assertEqual(request["last_frame_url"], "https://media.example/end.png")
        graph = build_workflow(request, "frame.png", "a" * 32, last_image_name="end_frame.png")
        self.assertIn("last_image", graph)
        self.assertEqual(graph["last_image"]["class_type"], "LoadImage")
        self.assertEqual(graph["last_image"]["inputs"]["image"], "end_frame.png")
        self.assertEqual(graph["condition"]["inputs"]["first_frame"], ["image", 0])
        self.assertEqual(graph["condition"]["inputs"]["last_frame"], ["last_image", 0])
        for node_id, node in graph.items():
            for value in node["inputs"].values():
                if isinstance(value, list) and len(value) == 2 and isinstance(value[0], str):
                    self.assertIn(value[0], graph, f"Two-frame {node_id} links to missing {value[0]}")

    def test_fl2va_single_frame_conditioning_has_no_last_frame_node_or_input(self):
        request = self.request()
        self.assertIsNone(request["last_frame_url"])
        graph = build_workflow(request, "frame.png", "a" * 32)
        self.assertNotIn("last_image", graph)
        self.assertNotIn("last_frame", graph["condition"]["inputs"])
        self.assertEqual(graph["condition"]["inputs"]["first_frame"], ["image", 0])

    def test_validate_request_last_frame_url_rules(self):
        with self.assertRaisesRegex(ValueError, "HTTPS image URL"):
            self.request(last_frame_url="http://insecure.example/frame.png")
        with self.assertRaisesRegex(ValueError, "HTTPS image URL"):
            self.request(last_frame_url="ftp://files.example/frame.png")
        # Empty or None should default to None
        self.assertIsNone(self.request(last_frame_url="")["last_frame_url"])
        self.assertIsNone(self.request(last_frame_url=None)["last_frame_url"])
        # Valid HTTPS should pass
        valid = self.request(last_frame_url="https://cdn.example.com/dest.jpg")
        self.assertEqual(valid["last_frame_url"], "https://cdn.example.com/dest.jpg")


if __name__ == "__main__":
    unittest.main()
