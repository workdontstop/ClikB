import mysql from "mysql2";
import util from "util";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file

const dbConfig = {
  user: process.env.USER_DATABASE,
  host: process.env.HOST_DATABASE,
  password: process.env.PASSWORD_DATABASE,
  database: process.env.DATABASE_NAME,
  charset: "utf8mb4",
};

console.log(process.env.HOST_DATABASE);

console.log("exec");

const pool = mysql.createPool(dbConfig);

// Create a utility function for executing queries
const execQuery = async (query: string, values: any[] = []): Promise<any> => {
  try {
    // Promisify the query method and bind to the pool
    const queryAsync: any = util.promisify(pool.query).bind(pool);

    // Execute the query
    return await queryAsync(query, values);
  } catch (error) {
    // Log the error and rethrow it for further handling
    console.error("Database query error:", error);
    throw error;
  }
};

export default execQuery;
