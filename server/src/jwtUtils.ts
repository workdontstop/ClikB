import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file

// Secret key for signing tokens
const secretKey: string | any = process.env.SECRET_KEYY;

//console.log(process.env.SECRET_KEYY);

/**
 * Generate a JWT token
 * @param id - The user ID to include in the token payload
 * @returns - A signed JWT token
 */
export const generateToken = (id: string): string => {
  const expiresIn = "30d"; // 12 months
  return jwt.sign({ id }, secretKey, { expiresIn });
};

/**
 * Verify a JWT token
 * @param token - The token to verify
 * @returns - The decoded token payload if valid
 */
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, secretKey);
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
};

/**
 * Decode a JWT token without verification
 * @param token - The token to decode
 * @returns - The decoded token payload
 */
export const decodeToken = (token: string): any => {
  return jwt.decode(token);
};
