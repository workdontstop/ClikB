"""Existing B300 deployment entrypoint, now backed by H3 FL2VA / ComfyUI.

The legacy filename/app name are retained to update the existing service.
The B200 Ref2VA service is unchanged. See H3_B300_IMPLEMENTATION.md before deploy.
"""

from modal_apps.h3_comfy_b300 import app, prepare_models, preflight  # noqa: F401
