import { Router } from "express";
import { signToken } from "../middleware/auth.js";

export default function authRoutes(db) {
  const router = Router();

  // =========================================================
  // LOGIN
  // POST /api/auth/login
  // =========================================================

  router.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({
          error: "Username and password are required.",
        });
      }

      const cleanUsername = String(username)
        .trim()
        .toLowerCase();

      const user = db.data.users.find(
        (u) =>
          String(u.username || "")
            .trim()
            .toLowerCase() === cleanUsername
      );

      // USER NOT FOUND OR WRONG PASSWORD
      if (!user || user.password !== password) {
        return res.status(401).json({
          error: "Invalid username or password.",
        });
      }

      // INACTIVE ACCOUNT
      if (user.status !== "Active") {
        return res.status(403).json({
          error: "This account is inactive.",
        });
      }

      // FIND HOUSEHOLD
      const householdMatch = db.data.households.find(
        (h) =>
          String(h.username || "")
            .trim()
            .toLowerCase() === cleanUsername
      );

      // CREATE TOKEN
      const token = signToken(user);

      return res.json({
        token,

        user: {
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
        },

        householdId: householdMatch
          ? householdMatch.id
          : null,
      });
    } catch (error) {
      console.error("LOGIN ERROR:", error);

      return res.status(500).json({
        error: "Unable to log in.",
      });
    }
  });

  // =========================================================
  // REGISTER
  // POST /api/auth/register
  // =========================================================

  router.post("/register", async (req, res) => {
    try {
      const {
        username,
        password,
        role = "resident",
      } = req.body || {};

      // VALIDATION
      if (!username || !password) {
        return res.status(400).json({
          error: "Username and password are required.",
        });
      }

      const cleanUsername = String(username).trim();

      if (cleanUsername.length < 3) {
        return res.status(400).json({
          error: "Username must be at least 3 characters.",
        });
      }

      if (password.length < 4) {
        return res.status(400).json({
          error: "Password must be at least 4 characters.",
        });
      }

      // NORMALIZE ROLE
      const cleanRole =
        role === "admin" ? "admin" : "resident";

      // CHECK DUPLICATE USERNAME
      const existingUser = db.data.users.find(
        (u) =>
          String(u.username || "")
            .trim()
            .toLowerCase() ===
          cleanUsername.toLowerCase()
      );

      if (existingUser) {
        return res.status(409).json({
          error:
            "Username already exists. Please choose another username.",
        });
      }

      // CREATE USER
      const newUser = {
        name: cleanUsername,
        username: cleanUsername,
        email: `${cleanUsername}@local`,
        role: cleanRole,
        status: "Active",
        password,
      };

      db.data.users.push(newUser);

      // SAVE DATABASE
      await db.write();

      console.log(
        `New account created: ${cleanUsername}`
      );

      return res.status(201).json({
        message: "Account created successfully.",

        user: {
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (error) {
      console.error("REGISTER ERROR:", error);

      return res.status(500).json({
        error: "Unable to create account.",
        message: error.message,
      });
    }
  });

  // =========================================================
  // DEMO ACCOUNTS
  // GET /api/auth/demo-accounts
  // =========================================================

  router.get("/demo-accounts", (req, res) => {
    try {
      return res.json(
        db.data.users.map((u) => ({
          name: u.name,
          username: u.username,
          email: u.email,
          role: u.role,
          password: u.password,
          status: u.status,
        }))
      );
    } catch (error) {
      console.error(
        "DEMO ACCOUNTS ERROR:",
        error
      );

      return res.status(500).json({
        error: "Unable to load demo accounts.",
      });
    }
  });

  return router;
}