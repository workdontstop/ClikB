import { Jimp } from 'jimp';

export const PROFILE_IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

/** Crop results are JPEG/PNG. Check the compressed header before allocating a bitmap. */
function dimensions(bytes: Buffer) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { mime: 'image/png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216) {
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 7)
        return { mime: 'image/jpeg', width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
      offset += length;
    }
  }
  throw new Error('Upload a cropped JPEG or PNG image.');
}

export async function validateProfileImageUpload(input: unknown): Promise<string> {
  if (typeof input !== 'string' || input.length > Math.ceil(PROFILE_IMAGE_UPLOAD_MAX_BYTES / 3) * 4 + 30)
    throw new Error('Use a cropped image smaller than 8 MB.');
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(input);
  if (!match || match[2].length % 4 !== 0) throw new Error('Upload a cropped JPEG or PNG image.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > PROFILE_IMAGE_UPLOAD_MAX_BYTES) throw new Error('Use a cropped image smaller than 8 MB.');
  const metadata = dimensions(bytes);
  if (metadata.mime !== match[1] || !metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192 ||
      metadata.width * metadata.height > 16_000_000) throw new Error('Use a cropped image up to 16 megapixels.');
  const decoded = await Jimp.read(bytes);
  if (decoded.bitmap.width * decoded.bitmap.height !== metadata.width * metadata.height)
    throw new Error('The cropped image dimensions could not be verified.');
  return input;
}
