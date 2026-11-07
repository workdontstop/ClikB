"""Small private ComfyUI nodes: real weight preload and browser-compatible MP4."""

from fractions import Fraction
from pathlib import Path
import re

import comfy.model_management
import folder_paths
from comfy_api.latest import InputImpl, Types


class ClikBH3Preload:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"model": ("MODEL",), "clip": ("CLIP",),
                             "video_vae": ("VAE",), "audio_vae": ("VAE",)}}

    RETURN_TYPES = ()
    FUNCTION = "execute"
    OUTPUT_NODE = True
    CATEGORY = "ClikB/internal"

    def execute(self, model, clip, video_vae, audio_vae):
        try:
            import sageattention
            if hasattr(sageattention, "patch_all"):
                sageattention.patch_all()
        except Exception:
            pass
        comfy.model_management.load_models_gpu([model, clip.patcher, video_vae.patcher, audio_vae.patcher])
        return {"ui": {"loaded": [True]}, "result": ()}


class ClikBH3Save:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"images": ("IMAGE",), "audio": ("AUDIO",),
                             "filename": ("STRING",), "include_audio": ("BOOLEAN",)}}

    RETURN_TYPES = ()
    FUNCTION = "execute"
    OUTPUT_NODE = True
    CATEGORY = "ClikB/internal"

    def execute(self, images, audio, filename, include_audio):
        if not re.fullmatch(r"[a-f0-9]{32}", filename):
            raise ValueError("Invalid H3 output ID")
        output = Path(folder_paths.get_output_directory()) / (filename + ".mp4")
        video = InputImpl.VideoFromComponents(Types.VideoComponents(
            images=images, audio=audio if include_audio else None, frame_rate=Fraction(24)),
            bit_depth=8, color_space="sRGB")
        video.save_to(str(output), format=Types.VideoContainer("mp4"), codec=Types.VideoCodec("h264"))
        return {"ui": {"videos": [{"filename": output.name, "subfolder": "", "type": "output"}]}, "result": ()}


NODE_CLASS_MAPPINGS = {"ClikBH3Preload": ClikBH3Preload, "ClikBH3Save": ClikBH3Save}
