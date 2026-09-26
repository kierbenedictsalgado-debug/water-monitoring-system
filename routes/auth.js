import { Router } from "express";
import { signToken } from "../middleware/auth.js";

export default function authRoutes(db) {
  const router = Router();

  // LOGIN
  // POST /api/auth/login
  router.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({
          error: "Username and password are required.",
        });
      }

      const cleanUsername = String(username).trim().toLowerCase();

      const user = db.data.users.find(
        (u) =>
          String(u.username || "").trim().toLowerCase() ===
          cleanUsername
      );

      if (!user || user.password !== password) {
        return res.status(401).json({
          error: "Invalid username or password.",
        });
      }

      if (user.status !== "Active") {
        return res.status(403).json({
          error: "This account is inactive.",
        });
      }

      const token = signToken(user);

      const household = db.data.households.find(
        (h) =>
          String(h.username || "").trim().toLowerCase() ===
          cleanUsername
      );

      return res.json({
        token,

        user: {
          name: user.name,
          username: user.username,
          email: user.email || "",
          role: user.role,
        },

        householdId: household
          ? household.id
          : null,
      });
    } catch (error) {
      console.error("Login error:", error);

      return res.status(500).json({
        error: "Internal server error.",
      });
    }
  });

  // REGISTER
  // POST /api/auth/register
  router.post("/register", async (req, res) => {
    try {
      const {
        username,
        password,
        role = "resident",
      } = req.body || {};

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

      // CHECK DUPLICATE USERNAME

      const existingUser = db.data.users.find(
        (u) =>
          String(u.username || "").trim().toLowerCase() ===
          cleanUsername.toLowerCase()
      );

      if (existingUser) {
        return res.status(409).json({
          message:
            "Username already exists. Please choose another username.",
        });
      }

      // ONLY ALLOW RESIDENT REGISTRATION FROM THE PUBLIC SIGNUP PAGE

      const userRole =
        role === "admin" ? "admin" : "resident";

      // CREATE USER

      const newUser = {
        name: cleanUsername,
        username: cleanUsername,
        email: `${cleanUsername.toLowerCase()}@local`,
        role: userRole,
        status: "Active",
        password,
      };

      db.data.users.push(newUser);

      // CREATE HOUSEHOLD FOR RESIDENT

      let householdId = null;

      if (userRole === "resident") {
        const numbers = db.data.households
          .map((h) => {
            const match = String(h.id).match(
              /^HH-(\d+)$/
            );

            return match
              ? Number(match[1])
              : 0;
          })
          .filter((n) => Number.isFinite(n));

        const nextNumber =
          numbers.length > 0
            ? Math.max(...numbers) + 1
            : 1;

        householdId = `HH-${String(
          nextNumber
        ).padStart(3, "0")}`;

        db.data.households.push({
          id: householdId,

          name: cleanUsername,

          username: cleanUsername,

          email: `${cleanUsername.toLowerCase()}@local`,

          barangay: "",

          accountType:
            "Residential — Standard",

          status: "Active",

          history: [
            {
              monthKey: "2025-12",
              month: "December 2025",
              consumption: 0,
            },
            {
              monthKey: "2026-01",
              month: "January 2026",
              consumption: 0,
            },
            {
              monthKey: "2026-02",
              month: "February 2026",
              consumption: 0,
            },
            {
              monthKey: "2026-03",
              month: "March 2026",
              consumption: 0,
            },
            {
              monthKey: "2026-04",
              month: "April 2026",
              consumption: 0,
            },
            {
              monthKey: "2026-05",
              month: "May 2026",
              consumption: 0,
            },
          ],

          forecast: null,
        });
      }

      // SAVE DATABASE

      await db.write();

      console.log(
        `New account created: ${cleanUsername}`
      );

      return res.status(201).json({
        message:
          "Account created successfully.",

        user: {
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
        },

        householdId,
      });
    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      return res.status(500).json({
        error: "Internal server error.",
      });
    }
  });

  // DEMO ACCOUNTS

  router.get("/demo-accounts", (req, res) => {
    return res.json(
      db.data.users.map((u) => ({
        name: u.name,
        username: u.username,
        email: u.email || "",
        role: u.role,
        password: u.password,
      }))
    );
  });

  return router;
}