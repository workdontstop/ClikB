import { Request, Response } from "express";
import execQuery from "./execQuery";
import { generateToken, verifyToken } from "./jwtUtils";

function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
var colorHolder = ["#32a852", "#32a0a8", "#6f32a8", "#a83265", "#a4a832"];

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
    (username, password, email, billboard1, billboardthumb1, billboard2, billboardthumb2, profile_image, profile_image_thumb, color1, color2, color_type, status, notification, tutorial, date, reg) 
  VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/**
 * Registration handler for Google Sign-Up
 */
export const registerHandlerGoogle = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { values } = req.body;

  // Validate input
  if (!values || !values.email) {
    return res.status(400).json({ message: "Invalid registration data." });
  }

  // Extract the part of the email before '@'
  const emailPrefix = values.email.split("@")[0];

  // Create a short date string to make the username unique
  const currentDate = new Date();
  const dateString = `${currentDate.getDate().toString().padStart(2, "0")}`;

  // Combine email prefix and date string for unique username
  const uniqueUsername = `${emailPrefix}_${dateString}`;

  // Generate random color index
  const colorans = getRandomInt(0, colorHolder.length - 1);
  const color = colorHolder[colorans];

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
    const signupData: any = await execQuery(registerQuery, [
      uniqueUsername, // Use the generated username
      null, // No password, set it to NULL in the DB
      values.email, // Email from Google
      bill1,
      bill1b,
      bill2,
      bill2b,
      profilepic,
      profilepicb,
      color,
      color, // Assuming color2 is same as color1; adjust if different
      0, // color_type default value
      1, // status (active)
      0, // notification default value
      1, // tutorial default value
      currentTime, // registration date
      1, // reg (assuming this indicates Google registration)
    ]);

    // Construct the payload
    const payloadValue = {
      id: signupData.insertId,
      email: values.email,
      username: uniqueUsername,
      userimage: profilepic,
      userimagethumb: profilepicb,
      usercolor1: color,
      usercolor2: color,
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
  const { email } = req.body.values;

  console.log(email);

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
    console.log(newToken);
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
    let userId: number;

    // Check for existing cookie
    const token = req.cookies.authToken;
    if (token) {
      try {
        const decoded: any = verifyToken(token);
        userId = decoded.id; // Use ID from token
        console.log(userId);

        console.log(decoded);
      } catch (err) {
        console.error("Invalid or expired token, logging in as guest.", err);
        userId = 1; // Default to guest login if token is invalid
      }
    } else {
      console.log("Guest logged In");
      userId = 1; // Default to guest login if no token exists
    }

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
    if (!token) {
      res.cookie("authToken", newToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

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
