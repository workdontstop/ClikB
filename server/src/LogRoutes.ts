import { Request, Response } from "express";
import execQuery, { withTransaction } from "./execQuery";
import { generateToken } from "./jwtUtils";
import { authenticatedOwnerId, authenticatedUserId } from './requestAuth';
import { verifiedGoogleEmail } from './googleIdentity';
import { readMemberDeckEnabled } from './AppDeckRoutes';
import { recordSignupNotifications } from './SocialNotificationEvents';

const NEW_MEMBER_PIXELS = 600;

const loginIdQueryGoogle = `
  SELECT 
    username, id,email,password, color1, color2, color_type, profile_image, profile_image_thumb,
    first_name, sur_name, quote, reg, billboard1, billboardthumb1, billboard2, billboardthumb2,
    biography 
  FROM members WHERE email = ?
`;

const loginIdQuery = `
  SELECT 
    username, id,email, password, color1, color2, color_type, profile_image, profile_image_thumb,
    first_name, sur_name, quote, reg, billboard1, billboardthumb1, billboard2, billboardthumb2,
    biography 
  FROM members WHERE id = ?
`;

// Define your registration query
const registerQuery = `
  INSERT INTO members 
    (username, password, email, billboard1, billboardthumb1, billboard2, billboardthumb2, profile_image, profile_image_thumb, color1, color2, color_type, status, notification, tutorial, date, reg,pixels) 
  VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
`;

/**
 * Registration handler for Google Sign-Up
 */
export const registerHandlerGoogle = async (
  req: Request,
  res: Response
): Promise<any> => {
  let email: string;
  try { email = await verifiedGoogleEmail(req.body?.values?.credential); }
  catch { return res.status(401).json({ message: "Google sign-in could not be verified." }); }

  // Extract the part of the email before '@'
  const emailPrefix = email.split("@")[0];

  // Create a short date string to make the username unique
  const currentDate = new Date();
  const dateString = `${currentDate.getDate().toString().padStart(2, "0")}`;

  // Combine email prefix and date string for unique username
  const uniqueUsername = `${emailPrefix}_${dateString}`;

  const currentTime = new Date();

  const bill1 =
    "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-722e6c57f283f4a76338103103b6a137.png";
  const bill1b =
    "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-08ff25127b8f4277ee2c0c119fde8b27.png";
  const bill2 =
    "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-722e6c57f283f4a76338103103b6a137.png";
  const bill2b =
    "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-08ff25127b8f4277ee2c0c119fde8b27.png";

  const profilepic =
    "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-ca22d826316c91076c3c76ed93c4485c.png";
  const profilepicb =
    "https://superstarz-data-tank.s3.eu-west-2.amazonaws.com/3589da673fb027adb4ca924a1b38ccd9";

  try {
    // Insert the new user into the database
    const signupData = await withTransaction(async query => {
      const member = await query(registerQuery, [
        uniqueUsername, // Use the generated username
        null, // No password, set it to NULL in the DB
        email, // Email from Google
        bill1,
        bill1b,
        bill2,
        bill2b,
        profilepic,
        profilepicb,
        null, // Use the app's light default until the user chooses an accent.
        null, // Use the app's dark default until the user chooses an accent.
        0, // color_type default value
        1, // status (active)
        0, // notification default value
        1, // tutorial default value
        currentTime, // registration date
        1, // reg (assuming this indicates Google registration)
        NEW_MEMBER_PIXELS,
      ]);
      await recordSignupNotifications(query, Number(member.insertId), NEW_MEMBER_PIXELS);
      return member;
    });

    // Construct the payload
    const payloadValue = {
      id: signupData.insertId,
      email,
      username: uniqueUsername,
      userimage: profilepic,
      userimagethumb: profilepicb,
      deckEnabled: true,
      usercolor1: null,
      usercolor2: null,
      usercolortype: 0,
      userfirstname: "",
      usersurname: "",
      userquote: " ",
      userreg: 1,
      userbillboard1: bill1,
      userbillboardthumb1: bill1b,
      userbillboard2: bill2,
      userbillboardthumb2: bill2b,
      biography: "",
      fans: 0, // Initialize fans count
      favorites: 0, // Initialize favorites count
    };

    // Generate a JWT token
    const newToken = generateToken(payloadValue.id);

    // Set the token in the 'authToken' cookie
    res.cookie("authToken", newToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Return the response
    return res.status(201).json({
      message: "Registered and logged in successfully",
      payload: payloadValue,
    });
  } catch (err: any) {
    console.error("Registration Error:", err);

    // Handle duplicate entry error (e.g., duplicate email)
    if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) {
      return res
        .status(409)
        .json({ message: "Email or username already exists." });
    }

    // Handle other errors
    return res
      .status(500)
      .json({ message: "An error occurred during registration." });
  }
};

export const loginHandlerGoogle = async (
  req: Request,
  res: Response
): Promise<any> => {
  let email: string;
  try { email = await verifiedGoogleEmail(req.body?.values?.credential); }
  catch { return res.status(401).json({ message: "Google sign-in could not be verified." }); }

  try {
    // Fetch user data from database
    const logindata: any = await execQuery(loginIdQueryGoogle, [email]);

    if (!logindata || logindata.length === 0) {
      return res.status(404).json({ message: "No user found" });
    }

    // Generate a new token only if it's a guest login
    const newToken = generateToken(logindata[0].id);
    console.log(logindata[0].id);

    const payloadValue = {
      id: logindata[0].id,
      email: logindata[0].email,
      username: logindata[0].username,
      userimage: logindata[0].profile_image,
      userimagethumb: logindata[0].profile_image_thumb,
      deckEnabled: await readMemberDeckEnabled(Number(logindata[0].id)),
      usercolor1: logindata[0].color1,
      usercolor2: logindata[0].color2,
      usercolortype: logindata[0].color_type,
      userfirstname: logindata[0].first_name,
      usersurname: logindata[0].sur_name,
      userquote: logindata[0].quote,
      userreg: logindata[0].reg,
      userbillboard1: logindata[0].billboard1,
      userbillboardthumb1: logindata[0].billboardthumb1,
      userbillboard2: logindata[0].billboard2,
      userbillboardthumb2: logindata[0].billboardthumb2,
      biography: logindata[0].biography,
      fans: logindata[0].fanCount,
      favorites: logindata[0].favoriteCount,
    };

    // Set the token in a cookie if logging in as a guest or token was invalid
    res.cookie("authToken", newToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Return the response
    return res.status(200).json({
      message: "Logged in successfully",
      payload: payloadValue,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Error occurred during login" });
  }
};

// Login handler
export const loginHandler = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const active = authenticatedUserId(req);
    const userId = Number(active || 1);
    const ownerId = Number(authenticatedOwnerId(req) || 1);
    const shouldRefreshAuthToken = !active;

    // Fetch user data from database
    const logindata: any = await execQuery(loginIdQuery, [userId]);

    if (!logindata || logindata.length === 0) {
      return res.status(404).json({ message: "No user found" });
    }

    // Generate a new token only if it's a guest login
    const newToken = generateToken(logindata[0].id);

    const payloadValue = {
      id: logindata[0].id,
      email: logindata[0].email,
      username: logindata[0].username,
      userimage: logindata[0].profile_image,
      userimagethumb: logindata[0].profile_image_thumb,
      deckEnabled: await readMemberDeckEnabled(Number(logindata[0].id)),
      usercolor1: logindata[0].color1,
      usercolor2: logindata[0].color2,
      usercolortype: logindata[0].color_type,
      userfirstname: logindata[0].first_name,
      usersurname: logindata[0].sur_name,
      userquote: logindata[0].quote,
      userreg: logindata[0].reg,
      userbillboard1: logindata[0].billboard1,
      userbillboardthumb1: logindata[0].billboardthumb1,
      userbillboard2: logindata[0].billboard2,
      userbillboardthumb2: logindata[0].billboardthumb2,
      biography: logindata[0].biography,
      fans: logindata[0].fanCount,
      favorites: logindata[0].favoriteCount,
    };

    // Guest is a normal authenticated user (member id 1). Always replace a
    // missing, invalid, or expired cookie with a valid Guest token so every
    // billing and creation route sees the same signed-in identity as the UI.
    if (shouldRefreshAuthToken) {
      res.cookie("authToken", newToken, {
        httpOnly: true,
        secure: process.env.APP_STATE !== "dev",
        sameSite: process.env.APP_STATE === "dev" ? "lax" : "none",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    // Return the response
    return res.status(200).json({
      message: "Logged in successfully",
      payload: { ...payloadValue, ownerId },
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Error occurred during login" });
  }
};

// Logout handler
export const logoutHandler = (_: Request, res: Response): void => {
  try {
    res.cookie("authToken", "", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error occurred during logout" });
  }
};
