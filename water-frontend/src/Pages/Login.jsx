
import { useState } from "react";
import {
  Droplets,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
} from "lucide-react";

const API = "http://localhost:4000";

const PASSWORD_RULES = [
  {
    label: "At least 8 characters",
    test: (p) => p.length >= 8,
  },
  {
    label: "One uppercase letter (A-Z)",
    test: (p) => /[A-Z]/.test(p),
  },
  {
    label: "One lowercase letter (a-z)",
    test: (p) => /[a-z]/.test(p),
  },
  {
    label: "One number (0-9)",
    test: (p) => /[0-9]/.test(p),
  },
  {
    label: "One special symbol (!@#$%)",
    test: (p) => /[^A-Za-z0-9\s]/.test(p),
  },
];

function PasswordChecklist({ password }) {
  const passed = PASSWORD_RULES.filter((rule) =>
    rule.test(password)
  ).length;

  return (
    <div className="password-requirements">
      <div className="password-requirements-heading">
        <span>Password requirements</span>
        <span>{passed}/5</span>
      </div>

      {PASSWORD_RULES.map((rule) => {
        const valid = rule.test(password);

        return (
          <div
            key={rule.label}
            className={`password-rule ${valid ? "passed" : ""}`}
          >
            {valid ? (
              <CheckCircle2 size={16} />
            ) : (
              <Circle size={16} />
            )}
            <span>{rule.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("homeowner");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strongPassword = PASSWORD_RULES.every((rule) =>
    rule.test(password)
  );

  const passwordsMatch =
    confirmPassword.length > 0 &&
    password === confirmPassword;

  function switchMode(nextMode) {
    setMode(nextMode);
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirm(false);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setError("Please enter your username and password.");
      return;
    }

    if (mode === "signup") {
      if (role === "admin") {
        setError(
          "Admin accounts cannot be registered here. Please contact the system administrator."
        );
        return;
      }

      if (cleanUsername.length < 3) {
        setError("Username must be at least 3 characters.");
        return;
      }

      if (!strongPassword) {
        setError("Please satisfy all five password requirements.");
        return;
      }

      if (!passwordsMatch) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "signup"
          ? `${API}/api/auth/register`
          : `${API}/api/auth/login`;

      const body =
        mode === "signup"
          ? {
              username: cleanUsername,
              password,
              role: "resident",
            }
          : {
              username: cleanUsername,
              password,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          data.message ||
            data.error ||
            (mode === "login"
              ? "Invalid username or password."
              : "Unable to create account.")
        );
        return;
      }

      let user = data.user;

      // Automatically log in after successful registration
      // if the registration endpoint does not return a user.
      if (mode === "signup" && !user) {
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

        const loginData = await loginResponse
          .json()
          .catch(() => ({}));

        if (!loginResponse.ok || !loginData.user) {
          switchMode("login");
          setError(
            "Account created, but automatic login failed. Please log in."
          );
          return;
        }

        user = loginData.user;
      }

      if (!user || !user.role) {
        setError("The server did not return valid user information.");
        return;
      }

      // Accept only the selected role.
      const actualRole =
        user.role === "resident" ? "homeowner" : user.role;

      if (actualRole !== role) {
        setError("This account does not have the selected role.");
        return;
      }

      onLogin(user);
    } catch (err) {
      console.error("Authentication error:", err);

      setError(
        err instanceof TypeError
          ? "Cannot connect to the server. Please start the backend."
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-background-circle circle-one" />
      <div className="login-background-circle circle-two" />

      <div className="login-card">
        <div className="login-logo">
          <Droplets size={34} />
        </div>

        <h1>Water Monitoring System</h1>

        <p className="login-subtitle">
          Smart household water consumption monitoring
        </p>

        <div className="login-role-buttons">
          {["homeowner", "admin"].map((item) => (
            <button
              key={item}
              type="button"
              className={
                role === item
                  ? "login-role active"
                  : "login-role"
              }
              onClick={() => {
                setRole(item);
                setError("");
              }}
              disabled={loading}
            >
              {item === "admin" ? "Admin" : "Homeowner"}
            </button>
          ))}
        </div>

        <div className="login-welcome">
          {mode === "signup" ? "Create Your Account" : "Welcome Back"}
        </div>

        <p className="login-description">
          {mode === "signup"
            ? "Create a homeowner account to monitor your water consumption."
            : "Log in to monitor your household water consumption."}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="auth-username">Username</label>
            <input
              id="auth-username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              placeholder={
                role === "admin"
                  ? "Enter admin username"
                  : "Enter homeowner username"
              }
              autoComplete="username"
              minLength={mode === "signup" ? 3 : undefined}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>

            <div className="password-field">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder={
                  mode === "signup"
                    ? "Create a strong password"
                    : "Enter your password"
                }
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                disabled={loading}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === "signup" && (
            <>
              <PasswordChecklist password={password} />

              <div className="form-group">
                <label htmlFor="confirm-password">
                  Confirm Password
                </label>

                <div className="password-field">
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    disabled={loading}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={
                      showConfirm
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                    disabled={loading}
                  >
                    {showConfirm ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                {confirmPassword && (
                  <div
                    className={`password-match ${
                      passwordsMatch ? "match" : "no-match"
                    }`}
                  >
                    {passwordsMatch
                      ? "Passwords match."
                      : "Passwords do not match."}
                  </div>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={
              loading ||
              (mode === "signup" &&
                (!strongPassword ||
                  !passwordsMatch ||
                  username.trim().length < 3 ||
                  role === "admin"))
            }
          >
            {loading
              ? "Please wait..."
              : mode === "signup"
                ? "Create Account"
                : `Login as ${role === "admin" ? "Admin" : "Homeowner"}`}
          </button>
        </form>

        <div className="signup-prompt">
          {mode === "signup" ? (
            <>
              <span>Already have an account?</span>
              <button
                type="button"
                className="signup-link"
                onClick={() => switchMode("login")}
                disabled={loading}
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              <span>Don't have a homeowner account?</span>
              <button
                type="button"
                className="signup-link"
                onClick={() => {
                  setRole("homeowner");
                  switchMode("signup");
                }}
                disabled={loading}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
