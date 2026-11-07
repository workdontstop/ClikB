"""Pure, CPU-testable FL2VA workflow and pinned model manifest.

No Modal calls, model imports or downloads occur when this module is imported.
"""

import math

COMFY_REVISION = "8a33128f2f8c5585c57486c07de481241e70a39c"
FBC_REVISION = "725973c3bfd9de6dce249bc93dc5fe27f820df31"
MODEL_REPO = "Comfy-Org/MiniMax-H3"
MODEL_REVISION = "4cc1d817b6184899b41293954329f576cb5ae86b"
TURBO_LORA_REPO = "lightx2v/MiniMax-H3-Turbo"
TURBO_LORA_REVISION = "ec01fa4c86263832faa0bd1d6d8f36a281eaabb2"
TURBO_LORA_FILE = "minimax_h3_fl2v_turbo_4step_v1.1_768p_comfyui_bf16.safetensors"
MODEL_FILES = {
    "diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors":
        (20970379616, "e889202c41dafb67b10d67b97f0d8541508036a6090af23425a5c2615d03c47a"),
    "text_encoders/qwen3vl_32b_minimax_h3_int8_convrot.safetensors":
        (27141342152, "bc2ced0fbea64757fa9acddccfc0b3f4819d1dcf1da6c124d690d368be283923"),
    "vae/minimax_h3_video_vae_fp16.safetensors":
        (5207808496, "7c1f131492e7eddacaac9069a61b81bdd39de5cc96561e677c5eab1cdce5e522"),
    "vae/minimax_h3_audio_vae_fp32.safetensors":
        (605254808, "8e505d95dd1561d47abd43d4238fd40d9bb1ae9e147ed0a4cba778d76ae4db48"),
    f"loras/{TURBO_LORA_FILE}":
        (1956192992, "449d80f301ac571622c72e28b8fd72a4b3681b7a8df8a92f17c8f6ec43f56558"),
}
# Every profile is generated and decoded at its selected native H3 canvas.
# The UI calls the native 768-short-edge profile "720p" for product continuity.
OUTPUT_SIZES = {
    "384p": {"16:9": (672, 384), "9:16": (384, 672), "1:1": (384, 384)},
    "480p": {"16:9": (832, 480), "9:16": (480, 832), "1:1": (480, 480)},
    "720p": {"16:9": (1344, 768), "9:16": (768, 1344), "1:1": (768, 768)},
}


def paid_remaining(value, now):
    deadline = value.get("paid_deadline_at")
    return max(0, math.ceil(float(deadline) - now)) if deadline is not None else max(
        0, int(value.get("paid_remaining_seconds") or 0))


def validate_request(payload):
    """Keep inference cost bounded; never accept arbitrary client workflows."""
    prompt = str(payload.get("prompt") or "").strip()
    if not prompt or len(prompt) > 20000:
        raise ValueError("A prompt of 1–20000 characters is required")
    image = str(payload.get("image_url") or "")
    if not image.startswith("https://"):
        raise ValueError("MiniMax H3 image-to-video requires an HTTPS opening image")
    last_image = payload.get("last_frame_url")
    if last_image is not None and str(last_image).strip():
        last_image = str(last_image).strip()
        if not last_image.startswith("https://"):
            raise ValueError("MiniMax H3 last_frame_url must be an HTTPS image URL")
    else:
        last_image = None
    duration = float(payload.get("duration", 5))
    if not math.isfinite(duration) or not 4 <= duration <= 15:
        raise ValueError("MiniMax H3 duration must be between 4 and 15 seconds")
    aspect = str(payload.get("aspect_ratio") or "16:9")
    if aspect not in OUTPUT_SIZES["480p"]:
        raise ValueError("Unsupported video aspect ratio")
    resolution = str(payload.get("resolution") or "480p").lower()
    if resolution not in OUTPUT_SIZES:
        raise ValueError("MiniMax H3 resolution must be 384p, 480p or 720p")
    # H3's native temporal grid is 17k+5 frames at 24fps.
    frames = math.ceil(duration * 24)
    frames += (5 - frames) % 17
    seed = int(payload.get("seed") or 0)
    if not 0 <= seed <= 2**64 - 1:
        raise ValueError("Seed must be an unsigned 64-bit integer")
    width, height = OUTPUT_SIZES[resolution][aspect]
    return {"prompt": prompt, "image_url": image, "last_frame_url": last_image,
            "frames": frames, "seed": seed, "resolution": resolution,
            "width": width, "height": height, "sample_width": width, "sample_height": height,
            "include_audio": payload.get("include_audio") is not False}


def loaders():
    return {
        "model": {"class_type": "UNETLoader", "inputs": {
            "unet_name": "minimax_h3_fl2va_pruned_int8_convrot.safetensors", "weight_dtype": "default"}},
        "clip": {"class_type": "CLIPLoader", "inputs": {
            "clip_name": "qwen3vl_32b_minimax_h3_int8_convrot.safetensors", "type": "minimax", "device": "default"}},
        "vvae": {"class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_video_vae_fp16.safetensors"}},
        "avae": {"class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_audio_vae_fp32.safetensors"}},
    }


def preload_workflow():
    return loaders() | {"preload": {"class_type": "ClikBH3Preload", "inputs": {
        "model": ["model", 0], "clip": ["clip", 0],
        "video_vae": ["vvae", 0], "audio_vae": ["avae", 0]}}}


def build_workflow(request, image_name, output_name, last_image_name=None):
    graph = loaders()
    model = ["model", 0]
    graph["lora"] = {
        "class_type": "LoraLoaderModelOnly",
        "inputs": {
            "model": model,
            "lora_name": TURBO_LORA_FILE,
            "strength_model": 1.0,
        }
    }
    model = ["lora", 0]
    # LightX2V's v1.1 owner recipe is four-step Euler with H3's paired
    # video/audio flow shifts set to 6.0/3.0.
    graph["shift"] = {"class_type": "MiniMaxH3SigmaShift", "inputs": {
        "model": model, "shift_video": 6.0, "shift_audio": 3.0}}
    model = ["shift", 0]
    graph["cache"] = {"class_type": "ApplyMiniMaxH3FirstBlockCache", "inputs": {
        "model": model, "mode": "H3 Fast — 0.10 / max 2", "threshold": 0.1,
        "start_percent": 0.1, "end_percent": 0.95,
        "max_consecutive_hits": 2, "temporal_guard": False}}
    model = ["cache", 0]
    condition_inputs = {
        "clip": ["clip", 0], "vae": ["vvae", 0], "first_frame": ["image", 0],
        "prompt": request["prompt"], "width": request["sample_width"],
        "height": request["sample_height"], "length": request["frames"],
    }
    if last_image_name:
        graph["last_image"] = {"class_type": "LoadImage", "inputs": {"image": last_image_name}}
        condition_inputs["last_frame"] = ["last_image", 0]
    graph.update({
        "image": {"class_type": "LoadImage", "inputs": {"image": image_name}},
        "condition": {"class_type": "MiniMaxH3ImageToVideo", "inputs": condition_inputs},
        "noise": {"class_type": "RandomNoise", "inputs": {"noise_seed": request["seed"]}},
        "sampler": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
        "schedule": {"class_type": "BasicScheduler", "inputs": {
            "model": model, "scheduler": "simple", "steps": 4, "denoise": 1.0}},
        "guider": {"class_type": "BasicGuider", "inputs": {
            "model": model, "conditioning": ["condition", 0]}},
        "sample": {"class_type": "SamplerCustomAdvanced", "inputs": {
            "noise": ["noise", 0], "guider": ["guider", 0], "sampler": ["sampler", 0],
            "sigmas": ["schedule", 0], "latent_image": ["condition", 1]}},
    })
    graph.update({
        "video": {"class_type": "VAEDecode", "inputs": {"samples": ["sample", 0], "vae": ["vvae", 0]}},
        "audio": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["sample", 0], "vae": ["avae", 0]}},
        "save": {"class_type": "ClikBH3Save", "inputs": {
            "images": ["video", 0], "audio": ["audio", 0], "filename": output_name,
            "include_audio": request["include_audio"]}},
    })
    return graph
