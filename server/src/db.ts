import execQuery from "./execQuery";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file

/**
 * Add a number of pixels to a user's balance.
 * @param userId  ID of the user in your members table
 * @param pixels  Number of pixels to add
 */
export async function addPixelsToUser(
  userId: string | number,
  pixels: number
): Promise<void> {
  const sql = `
    UPDATE members
    SET pixels = COALESCE(pixels, 0) + ?
    WHERE id = ?
  `;

  await execQuery(sql, [pixels, userId]);
}

/**
 * Get the current pixel balance for a user.
 * @param userId  ID of the user in your members table
 * @returns the pixel balance
 */
export async function getPixelsForUser(
  userId: string | number
): Promise<number> {
  const sql = `
    SELECT COALESCE(pixels, 0) AS pixels
    FROM members
    WHERE id = ?
  `;

  const results = await execQuery(sql, [userId]);
  // execQuery should return an array of rows
  if (Array.isArray(results) && results.length > 0) {
    return results[0].pixels;
  }
  return 0;
}

/**
 * Deduct a number of pixels from a user's balance.
 * @param userId  ID of the user in your members table
 * @param pixels  Number of pixels to deduct
 */
export async function spendPixels(
  userId: string | number,
  pixels: number
): Promise<void> {
  const sql = `
    UPDATE members
    SET pixels = GREATEST(COALESCE(pixels, 0) - ?, 0)
    WHERE id = ?
  `;

  await execQuery(sql, [pixels, userId]);
}
