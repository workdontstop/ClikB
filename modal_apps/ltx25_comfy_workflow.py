"""Pure, CPU-testable LTX-2.5 ComfyUI workflow and model manifest."""

import math

COMFY_REVISION = "30bdda1ef13a3a34fce2cd2fec633f15d832122a"
MODEL_REPO = "Lightricks/LTX-2.5"
MODEL_FILES = {
    "diffusion_models/ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors",
    "text_encoders/gemma4-12b-with-proj-ltx-2.5-bf16.safetensors",
    "vae/ltx-2.5-video-vae-bf16.safetensors",
    "vae/ltx-2.5-audio-vae-bf16.safetensors",
}

# Sampling canvases obey LTX's 32-pixel grid. Delivery crops padding only; it
# never stretches the generated video. Product names match the existing UI.
OUTPUT_SIZES = {
    "480p": {
        "16:9": (832, 480, 832, 480),
        "9:16": (480, 832, 480, 832),
        "1:1": (480, 480, 480, 480),
    },
    "720p": {
        "16:9": (1280, 736, 1280, 720),
        "9:16": (736, 1280, 720, 1280),
        "1:1": (736, 736, 720, 720),
    },
    "1080p": {
        "16:9": (1920, 1088, 1920, 1080),
        "9:16": (1088, 1920, 1080, 1920),
        "1:1": (1088, 1088, 1080, 1080),
    },
}

# Four denoising steps, retaining the important endpoints from LTX's official
# distilled schedule.
SIGMAS = "1.0, 0.975, 0.725, 0.421875, 0.0"


def paid_remaining(value, now):
    deadline = value.get("paid_deadline_at")
    return max(0, math.ceil(float(deadline) - now)) if deadline is not None else max(
        0, int(value.get("paid_remaining_seconds") or 0))


def validate_request(payload):
    prompt = str(payload.get("prompt") or "").strip()
    if not prompt or len(prompt) > 20000:
        raise ValueError("A prompt of 1–20000 characters is required")
    image = str(payload.get("image_url") or "")
    if not image.startswith("https://"):
        raise ValueError("LTX-2.5 image-to-video requires an HTTPS opening image")
    last_image = payload.get("last_frame_url")
    if last_image is not None and str(last_image).strip():
        last_image = str(last_image).strip()
        if not last_image.startswith("https://"):
            raise ValueError("LTX-2.5 last_frame_url must be an HTTPS image URL")
    else:
        last_image = None
    duration = float(payload.get("duration", 5))
    if not math.isfinite(duration) or not 4 <= duration <= 10:
        raise ValueError("LTX-2.5 duration must be between 4 and 10 seconds")
    aspect = str(payload.get("aspect_ratio") or "16:9")
    resolution = str(payload.get("resolution") or "720p").lower()
    if resolution not in OUTPUT_SIZES:
        raise ValueError("LTX-2.5 resolution must be 480p, 720p or 1080p")
    if aspect not in OUTPUT_SIZES[resolution]:
        raise ValueError("Unsupported video aspect ratio")
    frames = max(1, round(duration * 24))
    frames += (1 - frames) % 8
    seed = int(payload.get("seed") or 0)
    if not 0 <= seed <= 2**63 - 1:
        raise ValueError("Seed must be a non-negative signed 64-bit integer")
    sample_width, sample_height, width, height = OUTPUT_SIZES[resolution][aspect]
    return {
        "prompt": prompt,
        "negative_prompt": str(payload.get("negative_prompt") or "worst quality, inconsistent motion, distorted anatomy"),
        "image_url": image,
        "last_frame_url": last_image,
        "frames": frames,
        "seed": seed,
        "resolution": resolution,
        "sample_width": sample_width,
        "sample_height": sample_height,
        "width": width,
        "height": height,
        "fps": 24.0,
        "include_audio": payload.get("include_audio") is not False,
    }


def loaders():
    return {
        "model": {"class_type": "UNETLoader", "inputs": {
            "unet_name": "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors",
            "weight_dtype": "default",
        }},
        "clip": {"class_type": "CLIPLoader", "inputs": {
            "clip_name": "gemma4-12b-with-proj-ltx-2.5-bf16.safetensors",
            "type": "ltxv", "device": "default",
        }},
        "video_vae": {"class_type": "VAELoader", "inputs": {
            "vae_name": "ltx-2.5-video-vae-bf16.safetensors",
        }},
        "audio_vae": {"class_type": "VAELoader", "inputs": {
            "vae_name": "ltx-2.5-audio-vae-bf16.safetensors",
        }},
        # Native EasyCache handles current ComfyUI's joint video/audio model.
        # The old external TeaCache monkey-patches an LTX API that no longer
        # exists in this pinned ComfyUI build.
        "teacache": {"class_type": "EasyCache", "inputs": {
            "model": ["model", 0], "reuse_threshold": 0.06,
            "start_percent": 0.0, "end_percent": 1.0, "verbose": False,
        }},
    }


def preload_workflow():
    return loaders() | {
        "preload": {"class_type": "ClikBLTXPreload", "inputs": {
            "model": ["teacache", 0], "clip": ["clip", 0],
            "video_vae": ["video_vae", 0], "audio_vae": ["audio_vae", 0],
        }}
    }


def build_workflow(request, image_name, output_name, last_image_name=None):
    graph = loaders()
    graph.update({
        "image": {"class_type": "LoadImage", "inputs": {"image": image_name}},
        "positive_text": {"class_type": "CLIPTextEncode", "inputs": {
            "clip": ["clip", 0], "text": request["prompt"],
        }},
        "negative_text": {"class_type": "CLIPTextEncode", "inputs": {
            "clip": ["clip", 0], "text": request["negative_prompt"],
        }},
        "conditioning": {"class_type": "LTXVConditioning", "inputs": {
            "positive": ["positive_text", 0], "negative": ["negative_text", 0],
            "frame_rate": request["fps"],
        }},
        "preprocess": {"class_type": "LTXVPreprocess", "inputs": {
            "image": ["image", 0], "img_compression": 18,
        }},
        "empty_video": {"class_type": "EmptyLTXVLatentVideo", "inputs": {
            "width": request["sample_width"], "height": request["sample_height"],
            "length": request["frames"], "batch_size": 1,
        }},
        "empty_audio": {"class_type": "LTXVEmptyLatentAudio", "inputs": {
            "audio_vae": ["audio_vae", 0], "frames_number": request["frames"],
            "frame_rate": request["fps"], "batch_size": 1,
        }},
    })

    if last_image_name:
        graph.update({
            "last_image": {"class_type": "LoadImage", "inputs": {"image": last_image_name}},
            "preprocess_last": {"class_type": "LTXVPreprocess", "inputs": {
                "image": ["last_image", 0], "img_compression": 18,
            }},
            "guide_first": {"class_type": "LTXVAddGuide", "inputs": {
                "positive": ["conditioning", 0], "negative": ["conditioning", 1],
                "vae": ["video_vae", 0], "latent": ["empty_video", 0],
                "image": ["preprocess", 0], "frame_idx": 0, "strength": 0.7,
            }},
            "guide_last": {"class_type": "LTXVAddGuide", "inputs": {
                "positive": ["guide_first", 0], "negative": ["guide_first", 1],
                "vae": ["video_vae", 0], "latent": ["guide_first", 2],
                "image": ["preprocess_last", 0], "frame_idx": -1, "strength": 0.7,
            }},
        })
        video_latent = ["guide_last", 2]
        guider_positive = ["guide_last", 0]
        guider_negative = ["guide_last", 1]
    else:
        graph["i2v"] = {"class_type": "LTXVImgToVideoInplace", "inputs": {
            "vae": ["video_vae", 0], "image": ["preprocess", 0],
            "latent": ["empty_video", 0], "strength": 0.7, "bypass": False,
        }}
        video_latent = ["i2v", 0]
        guider_positive = ["conditioning", 0]
        guider_negative = ["conditioning", 1]

    graph.update({
        "av_latent": {"class_type": "LTXVConcatAVLatent", "inputs": {
            "video_latent": video_latent, "audio_latent": ["empty_audio", 0],
        }},
        "noise": {"class_type": "RandomNoise", "inputs": {"noise_seed": request["seed"]}},
        "guider": {"class_type": "CFGGuider", "inputs": {
            "model": ["teacache", 0], "positive": guider_positive,
            "negative": guider_negative, "cfg": 1.0,
        }},
        "sampler": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler_ancestral"}},
        "sigmas": {"class_type": "ManualSigmas", "inputs": {"sigmas": SIGMAS}},
        "sample": {"class_type": "SamplerCustomAdvanced", "inputs": {
            "noise": ["noise", 0], "guider": ["guider", 0], "sampler": ["sampler", 0],
            "sigmas": ["sigmas", 0], "latent_image": ["av_latent", 0],
        }},
        "separate": {"class_type": "LTXVSeparateAVLatent", "inputs": {"av_latent": ["sample", 0]}},
        "video_decode": {"class_type": "VAEDecodeTiled", "inputs": {
            "samples": ["separate", 0], "vae": ["video_vae", 0],
            "tile_size": 512, "overlap": 64, "temporal_size": 64, "temporal_overlap": 8,
        }},
        "audio_decode": {"class_type": "LTXVAudioVAEDecode", "inputs": {
            "samples": ["separate", 1], "audio_vae": ["audio_vae", 0],
        }},
        "save": {"class_type": "ClikBLTXSave", "inputs": {
            "images": ["video_decode", 0], "audio": ["audio_decode", 0],
            "filename": output_name, "include_audio": request["include_audio"],
            "width": request["width"], "height": request["height"],
        }},
    })
    return graph
