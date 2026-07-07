import { Request, Response } from 'express';
import { fal } from '@fal-ai/client';
// @ts-ignore
import potrace from 'potrace';
// @ts-ignore
import { Jimp } from 'jimp';

// Explicitly configure fal credentials to ensure it picks up the environment variable
fal.config({
  credentials: process.env.FAL_KEY!,
});

// Douglas-Peucker compression algorithm
// Compresses thousands of points from SAM into a few dozen for high-performance CSS clip-path

// We are now using the image mask endpoint, so the polygon compression algorithms have been removed.
export const samSegmentRoute = async (req: Request, res: Response): Promise<void> => {
    try {
        const { imageUrl, x, y } = req.body;

        console.log(`\n========== [SAM API] NEW REQUEST ==========`);
        console.log(`[SAM API] Received payload with keys:`, Object.keys(req.body));

        if (imageUrl) {
            console.log(`[SAM API] Image URL starts with: ${imageUrl.substring(0, 50)}...`);
            console.log(`[SAM API] Image payload size: ~${Math.round(imageUrl.length / 1024)} KB`);
        }

        if (!imageUrl || x === undefined || y === undefined) {
            console.error('[SAM API] ERROR: Missing imageUrl, x, or y in payload.');
            console.log(`[SAM API] Payload received: x=${x}, y=${y}, imageUrl exists=${!!imageUrl}`);
            res.status(400).json({ error: 'Missing imageUrl, x, or y' });
            return;
        }

        // Call Fal.ai SAM endpoint
        // NOTE: Make sure FAL_KEY is loaded in the environment
        const result: any = await fal.subscribe("fal-ai/sam-3/image", {
            input: {
                image_url: imageUrl,
                prompt: "", // Crucial: Overrides the model's default "wheel" prompt so it respects our point coordinates!
                point_prompts: [
                    { x: Math.round(x), y: Math.round(y), label: 1 as any },
                    { x: Math.round(x) - 40, y: Math.round(y), label: 1 as any },
                    { x: Math.round(x) + 40, y: Math.round(y), label: 1 as any },
                    { x: Math.round(x), y: Math.round(y) - 40, label: 1 as any },
                    { x: Math.round(x), y: Math.round(y) + 40, label: 1 as any },
                ],
                sync_mode: true, // Request the output to be returned immediately
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    update.logs.map((log) => log.message).forEach(console.log);
                }
            },
        });

        console.log("[SAM API] Fal.ai returned a response successfully!");
        console.log("[SAM API] Raw result keys:", Object.keys(result || {}));
        console.log("[SAM API] Raw result output:", JSON.stringify(result, null, 2).substring(0, 500)); // Log first 500 chars of result

        // Extract the exact base64 data URI mask from the model's output
        const apiData = result.data || result; // Handle both Fal client structure and direct REST structure
        const maskUrl = apiData.image?.url || (apiData.masks && apiData.masks[0]?.url) || null;
        const maskWidth = apiData.image?.width || (apiData.masks && apiData.masks[0]?.width) || 1080;
        const maskHeight = apiData.image?.height || (apiData.masks && apiData.masks[0]?.height) || 1920;

        let svgPath = null;
        if (maskUrl) {
            try {
                // maskUrl is a base64 string: data:image/png;base64,iVBORw0KGgo...
                const base64Data = maskUrl.split(',')[1] || maskUrl;
                const buffer = Buffer.from(base64Data, 'base64');
                const img = await (Jimp as any).read(buffer);

                // Convert white shape to black, and black background to white
                // because Potrace traces black pixels. SAM-3 returns opaque black and white images.
                img.scan(0, 0, img.bitmap.width, img.bitmap.height, (_x: number, _y: number, idx: number) => {
                    const r = img.bitmap.data[idx];
                    img.bitmap.data[idx] = 255 - r;
                    img.bitmap.data[idx + 1] = 255 - r;
                    img.bitmap.data[idx + 2] = 255 - r;
                    img.bitmap.data[idx + 3] = 255;
                });

                const modifiedBuffer = await img.getBuffer('image/png');

                svgPath = await new Promise((resolve, reject) => {
                    const trace = new potrace.Potrace({
                        turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
                        turdSize: 100,
                        optCurve: true,
                        optTolerance: 0.5,
                    });
                    trace.loadImage(modifiedBuffer, (err: any) => {
                        if (err) return reject(err);
                        const svgStr = trace.getSVG();
                        console.log(`[SAM API] Potrace generated raw SVG string (length: ${svgStr.length}). First 200 chars:`, svgStr.substring(0, 200));

                        const pathMatch = /<path d="([^"]+)"/.exec(svgStr);
                        if (!pathMatch) {
                            console.log("[SAM API] WARNING: Potrace returned an SVG without a <path d=...> element!");
                        } else {
                            console.log(`[SAM API] Extracted <path d=...> with length: ${pathMatch[1].length}`);
                            if (pathMatch[1].length < 15) {
                                console.log("[SAM API] WARNING: The extracted path is unusually short (might just be a single dot):", pathMatch[1]);
                            }
                        }
                        resolve(pathMatch ? pathMatch[1] : null);
                    });
                });
                console.log("[SAM API] Successfully traced SVG path from mask image.");
            } catch (err) {
                console.error("[SAM API] Failed to trace mask image to SVG:", err);
            }
        }

        res.status(200).json({
            success: !!svgPath,
            svgPath,
            maskWidth,
            maskHeight,
            // Removed maskUrl to save bandwidth
            data: result
        });

        console.log(`========== [SAM API] END REQUEST ==========\n`);
        return;



    } catch (error: any) {
        console.error('\n========== [SAM API] FATAL ERROR ==========');
        console.error('[SAM API] Error Message:', error.message);
        console.error('[SAM API] Error Stack:', error.stack);
        if (error.body) {
            console.error('[SAM API] Fal.ai Response Error Body:', JSON.stringify(error.body, null, 2));
        }
        if (error.response) {
            console.error('[SAM API] Fal.ai Response Error Body:', error.response.data || error.response.body);
        }
        console.error('===========================================\n');
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};
