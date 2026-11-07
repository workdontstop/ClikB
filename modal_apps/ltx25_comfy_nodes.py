"""Private LTX nodes for VRAM preload and browser-compatible MP4 delivery."""

from fractions import Fraction
from pathlib import Path
import re
import subprocess

import comfy.model_management
import folder_paths
from comfy_api.latest import InputImpl, Types


class ClikBLTXPreload:
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
        comfy.model_management.load_models_gpu(
            [model, clip.patcher, video_vae.patcher, audio_vae.patcher])
        return {"ui": {"loaded": [True]}, "result": ()}


class ClikBLTXSave:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"images": ("IMAGE",), "audio": ("AUDIO",),
                             "filename": ("STRING",), "include_audio": ("BOOLEAN",),
                             "width": ("INT",), "height": ("INT",)}}

    RETURN_TYPES = ()
    FUNCTION = "execute"
    OUTPUT_NODE = True
    CATEGORY = "ClikB/internal"

    def execute(self, images, audio, filename, include_audio, width, height):
        if not re.fullmatch(r"[a-f0-9]{32}", filename):
            raise ValueError("Invalid LTX output ID")
        source_height, source_width = int(images.shape[1]), int(images.shape[2])
        if width > source_width or height > source_height:
            raise ValueError("Requested delivery crop exceeds the generated LTX canvas")
        x = (source_width - width) // 2
        y = (source_height - height) // 2
        images = images[:, y:y + height, x:x + width, :]
        output = Path(folder_paths.get_output_directory()) / (filename + ".mp4")
        encoded_output = output if include_audio else output.with_suffix(".with-audio.mp4")
        video = InputImpl.VideoFromComponents(Types.VideoComponents(
            images=images, audio=audio, frame_rate=Fraction(24)),
            bit_depth=8, color_space="sRGB")
        video.save_to(str(encoded_output), format=Types.VideoContainer("mp4"), codec=Types.VideoCodec("h264"))
        if not include_audio:
            try:
                subprocess.run([
                    "ffmpeg", "-v", "error", "-xerror", "-y", "-i", str(encoded_output),
                    "-map", "0:v:0", "-c:v", "copy", "-an", "-movflags", "+faststart",
                    str(output),
                ], check=True, timeout=120, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            finally:
                encoded_output.unlink(missing_ok=True)
        return {"ui": {"videos": [{"filename": output.name, "subfolder": "", "type": "output"}]},
                "result": ()}


NODE_CLASS_MAPPINGS = {"ClikBLTXPreload": ClikBLTXPreload, "ClikBLTXSave": ClikBLTXSave}
