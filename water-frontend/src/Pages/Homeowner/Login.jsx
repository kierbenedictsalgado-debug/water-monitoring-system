import { useState } from "react";
import { Droplets, Eye, EyeOff } from "lucide-react";

const API = "http://localhost:4000";

function Login({ onLogin }) {
  // =========================================================
  // STATE
  // =========================================================

  const [mode, setMode] = useState("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // CLEAR ERROR
  // =========================================================

  const clearError = () => {
    setError("");
  };

  // =========================================================
  // SWITCH LOGIN / SIGNUP
  // =========================================================

  const switchMode = (newMode) => {
    setMode(newMode);

    setUsername("");
    setPassword("");
    setShowPassword(false);

    clearError();
  };

  // =========================================================
  // LOGIN
  // =========================================================

  const handleLogin = async (e) => {
    e.preventDefault();

    clearError();

    const cleanUsername = username.trim();

    // Check username
    if (!cleanUsername) {
      setError("Please enter your username.");
      return;
    }

    // Check password
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      // Send login request to backend
      const response = await fetch(
        `${API}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: cleanUsername,
            password,
          }),
        }
      );

      // Read server response
      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      // Incorrect username/password
      if (!response.ok) {
        setError(
          "Incorrect username or password."
        );
        return;
      }

      // Check returned user
      if (!data.user) {
        setError("Login failed. Please try again.");
        return;
      }

      // Check user role
      if (!data.user.role) {
        setError(
          "Login failed. User role is missing."
        );
        return;
      }

      // Login successful
      onLogin(data.user);

    } catch (err) {
      console.error("Login error:", err);

      // Backend is not running
      if (
        err.name === "TypeError" ||
        err.message === "Failed to fetch"
      ) {
        setError(
          "Cannot connect to the server. Please start the backend."
        );
      } else {
        setError(
          "Something went wrong. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // SIGN UP
  // =========================================================

  const handleSignup = async (e) => {
    e.preventDefault();

    clearError();

    const cleanUsername = username.trim();

    // Check username
    if (!cleanUsername) {
      setError("Please choose a username.");
      return;
    }

    if (cleanUsername.length < 3) {
      setError(
        "Username must be at least 3 characters."
      );
      return;
    }

    // Check password
    if (!password) {
      setError("Please create a password.");
      return;
    }

    if (password.length < 4) {
      setError(
        "Password must be at least 4 characters."
      );
      return;
    }

    setLoading(true);

    try {
      // =====================================================
      // CREATE ACCOUNT
      // =====================================================

      const registerResponse = await fetch(
        `${API}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: cleanUsername,
            password,
            role: "resident",
          }),
        }
      );

      let registerData = {};

      try {
        registerData =
          await registerResponse.json();
      } catch {
        registerData = {};
      }

      // Account creation failed
      if (!registerResponse.ok) {
        setError(
          registerData.message ||
            registerData.error ||
            "Unable to create account."
        );
        return;
      }

      // =====================================================
      // AUTOMATIC LOGIN AFTER SIGNUP
      // =====================================================

      const loginResponse = await fetch(
        `${API}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: cleanUsername,
            password,
          }),
        }
      );

      let loginData = {};

      try {
        loginData =
          await loginResponse.json();
      } catch {
        loginData = {};
      }

      // Automatic login failed
      if (!loginResponse.ok) {
        setError(
          "Account created, but automatic login failed. Please log in."
        );

        setMode("login");
        setPassword("");

        return;
      }

      // Check returned user
      if (!loginData.user) {
        setError(
          "Account created, but login failed."
        );

        setMode("login");
        setPassword("");

        return;
      }

      // =====================================================
      // ENTER SYSTEM AUTOMATICALLY
      // =====================================================

      onLogin(loginData.user);

    } catch (err) {
      console.error(
        "Registration error:",
        err
      );

      // Backend is not running
      if (
        err.name === "TypeError" ||
        err.message === "Failed to fetch"
      ) {
        setError(
          "Cannot connect to the server. Please start the backend."
        );
      } else {
        setError(
          "Something went wrong. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // LOGIN / SIGNUP UI
  // =========================================================

  return (
    <div className="landing">

      <div className="login-card">

        {/* ===================================================
            APP ICON
        =================================================== */}

        <div className="login-logo">
          <Droplets size={34} />
        </div>

        {/* ===================================================
            SYSTEM TITLE
        =================================================== */}

        <h1>
          Water Monitoring System
        </h1>

        <p className="login-subtitle">
          Smart household water consumption monitoring
        </p>

        {/* ===================================================
            LOGIN PAGE
        =================================================== */}

        {mode === "login" && (
          <>
            {/* LOGIN HEADING */}

            <div className="login-welcome">
              Welcome Back
            </div>

            <p className="login-description">
              Log in to monitor your household
              water consumption.
            </p>

            {/* LOGIN FORM */}

            <form
              className="login-form"
              onSubmit={handleLogin}
            >

              {/* USERNAME */}

              <label htmlFor="login-username">
                Username
              </label>

              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                placeholder="Enter your username"
                autoComplete="username"
                disabled={loading}
              />

              {/* PASSWORD */}

              <label htmlFor="login-password">
                Password
              </label>

              <div className="password-field">

                <input
                  id="login-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                />

                {/* PASSWORD SHOW / HIDE BUTTON */}

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>

              </div>

              {/* ERROR MESSAGE */}

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              {/* LOGIN BUTTON */}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading
                  ? "Signing In..."
                  : "Login"}
              </button>

            </form>

            {/* SIGNUP LINK */}

            <div className="signup-prompt">

              <span>
                Don't have an account?
              </span>

              <button
                type="button"
                className="signup-link"
                onClick={() =>
                  switchMode("signup")
                }
                disabled={loading}
              >
                Sign Up
              </button>

            </div>
          </>
        )}

        {/* ===================================================
            SIGNUP PAGE
        =================================================== */}

        {mode === "signup" && (
          <>
            {/* SIGNUP HEADING */}

            <div className="login-welcome">
              Create Your Account
            </div>

            <p className="login-description">
              Create a simple homeowner account
              to monitor your household water
              consumption.
            </p>

            {/* SIGNUP FORM */}

            <form
              className="login-form"
              onSubmit={handleSignup}
            >

              {/* USERNAME */}

              <label htmlFor="signup-username">
                Username
              </label>

              <input
                id="signup-username"
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                placeholder="Choose a username"
                autoComplete="username"
                disabled={loading}
              />

              {/* PASSWORD */}

              <label htmlFor="signup-password">
                Password
              </label>

              <div className="password-field">

                <input
                  id="signup-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Create a password"
                  autoComplete="new-password"
                  disabled={loading}
                />

                {/* PASSWORD SHOW / HIDE BUTTON */}

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>

              </div>

              {/* ERROR MESSAGE */}

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              {/* CREATE ACCOUNT BUTTON */}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading
                  ? "Creating Account..."
                  : "Create Account"}
              </button>

            </form>

            {/* BACK TO LOGIN */}

            <div className="signup-prompt">

              <span>
                Already have an account?
              </span>

              <button
                type="button"
                className="signup-link"
                onClick={() =>
                  switchMode("login")
                }
                disabled={loading}
              >
                Login
              </button>

            </div>
          </>
        )}

      </div>

    </div>
  );
}

export default Login;