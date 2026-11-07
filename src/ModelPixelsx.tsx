/* -----------------------------------------------------------
 *  ModelPixelsx
 *
 *  This used to be a byte-for-byte copy of ModelPixels.tsx, which meant
 *  the pricing table (MODEL_IPD) had to be updated in two places and
 *  silently drifted whenever only one was touched.
 *
 *  It is now a thin alias over ModelPixels so there is exactly ONE
 *  pricing source of truth. Do not re-add a local MODEL_IPD here.
 * ---------------------------------------------------------- */

export type { ModelKey, ModelPixelsArgs } from "./ModelPixels";
export { calcModelPixels } from "./ModelPixels";

import ModelPixels from "./ModelPixels";

export const ModelPixelsx = ModelPixels;

export default ModelPixelsx;
