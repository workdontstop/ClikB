"""Offline contract tests for LTX-2.5 ComfyUI workflow.

Validates single-frame backward compatibility, two-frame conditioning wiring,
and request validation rules completely on CPU without any Modal GPU usage.
"""

import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from modal_apps.ltx25_comfy_workflow import build_workflow, validate_request, OUTPUT_SIZES


class LTX25WorkflowTests(unittest.TestCase):
    def request(self, **overrides):
        return validate_request({
            "prompt": "Walking across the room",
            "image_url": "https://media.example/start.png",
            **overrides,
        })

    def test_single_frame_backward_compatibility(self):
        """Single-frame generation must produce the exact legacy LTXVImgToVideoInplace graph."""
        req = self.request()
        self.assertIsNone(req["last_frame_url"])
        graph = build_workflow(req, "start.png", "output_123")

        # Must use in-place single-frame node
        self.assertIn("i2v", graph)
        self.assertEqual(graph["i2v"]["class_type"], "LTXVImgToVideoInplace")
        self.assertEqual(graph["i2v"]["inputs"]["image"], ["preprocess", 0])
        self.assertEqual(graph["i2v"]["inputs"]["latent"], ["empty_video", 0])
        self.assertEqual(graph["i2v"]["inputs"]["strength"], 0.7)

        # Must NOT have two-frame guide nodes or last_image
        self.assertNotIn("last_image", graph)
        self.assertNotIn("preprocess_last", graph)
        self.assertNotIn("guide_first", graph)
        self.assertNotIn("guide_last", graph)

        # av_latent and guider must connect to i2v and conditioning
        self.assertEqual(graph["av_latent"]["inputs"]["video_latent"], ["i2v", 0])
        self.assertEqual(graph["guider"]["inputs"]["positive"], ["conditioning", 0])
        self.assertEqual(graph["guider"]["inputs"]["negative"], ["conditioning", 1])

        # Verify zero dangling links
        for node_id, node in graph.items():
            for key, value in node["inputs"].items():
                if isinstance(value, list) and len(value) == 2 and isinstance(value[0], str):
                    self.assertIn(value[0], graph, f"Single-frame {node_id}.{key} links to missing {value[0]}")

    def test_two_frame_conditioning_wiring(self):
        """Two-frame generation must chain LTXVAddGuide for frame 0 and frame -1."""
        req = self.request(last_frame_url="https://media.example/dest.png")
        self.assertEqual(req["last_frame_url"], "https://media.example/dest.png")
        graph = build_workflow(req, "start.png", "output_123", last_image_name="dest.png")

        # Must NOT use single-frame i2v node
        self.assertNotIn("i2v", graph)

        # Must include last image loading and preprocessing
        self.assertIn("last_image", graph)
        self.assertEqual(graph["last_image"]["class_type"], "LoadImage")
        self.assertEqual(graph["last_image"]["inputs"]["image"], "dest.png")
        self.assertIn("preprocess_last", graph)
        self.assertEqual(graph["preprocess_last"]["class_type"], "LTXVPreprocess")

        # Must chain guide_first (frame_idx=0) and guide_last (frame_idx=-1)
        self.assertIn("guide_first", graph)
        self.assertEqual(graph["guide_first"]["class_type"], "LTXVAddGuide")
        self.assertEqual(graph["guide_first"]["inputs"]["frame_idx"], 0)
        self.assertEqual(graph["guide_first"]["inputs"]["image"], ["preprocess", 0])
        self.assertEqual(graph["guide_first"]["inputs"]["latent"], ["empty_video", 0])
        self.assertEqual(graph["guide_first"]["inputs"]["positive"], ["conditioning", 0])
        self.assertEqual(graph["guide_first"]["inputs"]["negative"], ["conditioning", 1])

        self.assertIn("guide_last", graph)
        self.assertEqual(graph["guide_last"]["class_type"], "LTXVAddGuide")
        self.assertEqual(graph["guide_last"]["inputs"]["frame_idx"], -1)
        self.assertEqual(graph["guide_last"]["inputs"]["image"], ["preprocess_last", 0])
        self.assertEqual(graph["guide_last"]["inputs"]["latent"], ["guide_first", 2])
        self.assertEqual(graph["guide_last"]["inputs"]["positive"], ["guide_first", 0])
        self.assertEqual(graph["guide_last"]["inputs"]["negative"], ["guide_first", 1])

        # av_latent and guider must connect to guide_last outputs
        self.assertEqual(graph["av_latent"]["inputs"]["video_latent"], ["guide_last", 2])
        self.assertEqual(graph["guider"]["inputs"]["positive"], ["guide_last", 0])
        self.assertEqual(graph["guider"]["inputs"]["negative"], ["guide_last", 1])

        # Verify zero dangling links
        for node_id, node in graph.items():
            for key, value in node["inputs"].items():
                if isinstance(value, list) and len(value) == 2 and isinstance(value[0], str):
                    self.assertIn(value[0], graph, f"Two-frame {node_id}.{key} links to missing {value[0]}")

    def test_all_resolutions_and_aspect_ratios_two_frame_have_no_dangling_links(self):
        """Verify graph integrity across all supported resolutions and aspect ratios."""
        for resolution in ("480p", "720p", "1080p"):
            for aspect in OUTPUT_SIZES[resolution]:
                req = self.request(
                    resolution=resolution,
                    aspect_ratio=aspect,
                    last_frame_url="https://media.example/dest.png",
                )
                graph = build_workflow(req, "start.png", "out", last_image_name="dest.png")
                for node_id, node in graph.items():
                    for key, value in node["inputs"].items():
                        if isinstance(value, list) and len(value) == 2 and isinstance(value[0], str):
                            self.assertIn(value[0], graph, f"{resolution}/{aspect} {node_id}.{key} links to {value[0]}")

    def test_request_validation_rules(self):
        """Validate payload security, duration bounds, and HTTPS enforcement."""
        with self.assertRaisesRegex(ValueError, "HTTPS opening image"):
            self.request(image_url="http://insecure.example/start.png")

        with self.assertRaisesRegex(ValueError, "HTTPS image URL"):
            self.request(last_frame_url="http://insecure.example/dest.png")

        with self.assertRaisesRegex(ValueError, "HTTPS image URL"):
            self.request(last_frame_url="ftp://files.example/dest.png")

        # Empty or None should default to None
        self.assertIsNone(self.request(last_frame_url="")["last_frame_url"])
        self.assertIsNone(self.request(last_frame_url=None)["last_frame_url"])

        # Valid HTTPS should pass
        valid = self.request(last_frame_url="https://cdn.example.com/dest.jpg")
        self.assertEqual(valid["last_frame_url"], "https://cdn.example.com/dest.jpg")

        # Duration bounds (4 to 10 seconds for LTX-2.5)
        for duration in [0, 3.9, 10.1, 15, float("nan")]:
            with self.assertRaises(ValueError):
                self.request(duration=duration)


if __name__ == "__main__":
    unittest.main()
