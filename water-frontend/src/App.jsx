
import { useEffect, useState } from "react";

import {
  Bell,
  Database,
  Droplets,
  Eye,
  EyeOff,
  FileText,
  Home,
  Lightbulb,
  LogOut,
  Menu,
  Settings,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import "./App.css";

import Consumption from "./Pages/Homeowner/Consumption";
import Forecast from "./Pages/Homeowner/Forecasting";
import Dashboard from "./Pages/Homeowner/Dashboard";
import Recommendation from "./Pages/Homeowner/Recommendation";

const API = "http://localhost:4000";
const SESSION_KEY = "waterSessionUser";

const residentNav = [
  ["dashboard", "Dashboard", Home],
  ["consumption", "My Consumption", Droplets],
  ["forecast", "Forecast", TrendingUp],
  ["tips", "Water-Saving Tips", Lightbulb],
];

const adminNav = [
  ["dashboard", "Dashboard", Home],
  ["households", "Households", Users],
  ["data", "Data Management", Database],
  ["forecasting", "Forecasting Management", TrendingUp],
  ["reports", "Reports", FileText],
  ["users", "Users", Users],
  ["settings", "System Settings", Settings],
];

// ============================================================
// SESSION HELPERS
// ============================================================

function getSessionUser() {
  try {
    const savedUser = sessionStorage.getItem(SESSION_KEY);

    if (!savedUser) return null;

    const user = JSON.parse(savedUser);

    if (!user || !["admin", "resident"].includes(user.role)) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    return user;
  } catch (error) {
    console.error("Unable to restore session:", error);
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

// ============================================================
// LOGIN AND SIGNUP
// ============================================================

function Landing({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function switchMode(newMode) {
    setMode(newMode);
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError("");
    setSuccess("");
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          data.message || data.error || "Invalid username or password."
        );
        return;
      }

      if (!data.user || !["admin", "resident"].includes(data.user.role)) {
        setError("The server returned invalid user information.");
        return;
      }

      onLogin({
        ...data.user,
        token: data.token ?? data.user.token ?? null,
        householdId: data.householdId ?? data.user.householdId ?? null,
      });
    } catch (err) {
      console.error("Login error:", err);
      setError("Cannot connect to the server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanUsername = username.trim();

    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          password,
          role: "resident",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          data.message || data.error || "Unable to create your account."
        );
        return;
      }

      setMode("login");
      setUsername(cleanUsername);
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setSuccess("Account created successfully. Please sign in.");
    } catch (err) {
      console.error("Registration error:", err);
      setError("Cannot connect to the server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing">
      <div className="login-card">
        <div className="login-logo">
          <Droplets size={34} />
        </div>

        <h1>Water Monitoring System</h1>

        <p className="login-subtitle">
          Smart household water consumption monitoring
        </p>

        {mode === "login" ? (
          <>
            <div className="landing-heading">Welcome Back</div>

            <p className="landing-description">
              Sign in to monitor your household water consumption.
            </p>

            <form className="login-form" onSubmit={handleLogin}>
              <label htmlFor="login-username">Username</label>

              <input
                id="login-username"
                type="text"
                placeholder="Enter your username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
              />

              <label htmlFor="login-password">Password</label>

              <div className="password-field">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && <div className="login-error" role="alert">{error}</div>}
              {success && <div className="login-success" role="status">{success}</div>}

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="signup-prompt">
              <span>Don't have an account?</span>
              <button
                type="button"
                className="signup-link"
                onClick={() => switchMode("signup")}
                disabled={loading}
              >
                Sign Up
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="landing-heading">Create Your Account</div>

            <p className="landing-description">
              Create a homeowner account to monitor your water consumption.
            </p>

            <form className="login-form" onSubmit={handleSignup}>
              <label htmlFor="signup-username">Username</label>

              <input
                id="signup-username"
                type="text"
                placeholder="Choose a username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                disabled={loading}
                required
              />

              <label htmlFor="signup-password">Password</label>

              <div className="password-field">
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={4}
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <label htmlFor="signup-confirm">Confirm Password</label>

              <div className="password-field">
                <input
                  id="signup-confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                  disabled={loading}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && <div className="login-error" role="alert">{error}</div>}
              {success && <div className="login-success" role="status">{success}</div>}

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            <div className="signup-prompt">
              <span>Already have an account?</span>
              <button
                type="button"
                className="signup-link"
                onClick={() => switchMode("login")}
                disabled={loading}
              >
                Sign In
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SIDEBAR
// ============================================================

function Sidebar({
  role,
  tab,
  setTab,
  onLogout,
  mobileOpen,
  setMobileOpen,
}) {
  const navigation = role === "admin" ? adminNav : residentNav;

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="side-brand">
          <div className="brand-drop small">
            <Droplets size={20} />
          </div>

          <div className="brand-text">
            <div className="brand-name">Water Monitoring</div>
            <div className="side-tag">
              {role === "admin" ? "Administrator Portal" : "Homeowner Portal"}
            </div>
          </div>

          <button
            type="button"
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="menu-label">MENU</div>

        {navigation.map(([id, label, Icon]) => (
          <button
            type="button"
            key={id}
            className={`nav-item ${tab === id ? "active" : ""}`}
            onClick={() => {
              setTab(id);
              setMobileOpen(false);
            }}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}

        <div className="sidebar-bottom">
          <button type="button" className="nav-item" onClick={onLogout}>
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// ============================================================
// TOPBAR
// ============================================================

function Topbar({ role, setMobileOpen, apiOk }) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="menu-button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      <div className="breadcrumb">
        {role === "admin" ? "Administrator Portal" : "Homeowner Portal"}
      </div>

      <div className="top-actions">
        <div className={`api-status ${apiOk ? "connected" : ""}`}>
          <span />
          {apiOk ? "API Connected" : "API Offline"}
        </div>

        <button
          type="button"
          className="icon-button"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={18} />
        </button>

        <div className="avatar">{role === "admin" ? "AD" : "HO"}</div>
      </div>
    </header>
  );
}

// ============================================================
// ADMIN PAGES
// ============================================================

function AdminPage({ tab }) {
  const pages = {
    households: {
      title: "Households",
      description: "Manage registered household information.",
    },
    data: {
      title: "Data Management",
      description: "Manage household water consumption records.",
    },
    forecasting: {
      title: "Forecasting Management",
      description: "Review water consumption forecasting information.",
    },
    reports: {
      title: "Reports",
      description: "Generate consumption and forecasting reports.",
    },
    users: {
      title: "Users Management",
      description: "Manage homeowner and administrator accounts.",
    },
    settings: {
      title: "System Settings",
      description: "Configure system settings.",
    },
  };

  const page = pages[tab];

  return (
    <div className="card">
      <div className="card-title">
        {page?.title || "Administrator Dashboard"}
      </div>
      <p className="muted">
        {page?.description || "Welcome to the administration portal."}
      </p>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

export default function App() {
  const [user, setUser] = useState(() => getSessionUser());
  const [role, setRole] = useState(() => getSessionUser()?.role ?? null);

  const [tab, setTab] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [apiOk, setApiOk] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkBackend() {
      try {
        const response = await fetch(`${API}/api/health`);

        if (!response.ok) {
          throw new Error("Backend health check failed");
        }

        if (active) setApiOk(true);
      } catch {
        if (active) setApiOk(false);
      }
    }

    checkBackend();

    const intervalId = window.setInterval(checkBackend, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  function handleLogin(userData) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
      localStorage.setItem("waterUser", JSON.stringify(userData));

      if (userData.token) {
        localStorage.setItem("waterToken", userData.token);
      } else {
        localStorage.removeItem("waterToken");
      }

      if (userData.householdId != null) {
        localStorage.setItem(
          "waterHouseholdId",
          String(userData.householdId)
        );
      } else {
        localStorage.removeItem("waterHouseholdId");
      }
    } catch (error) {
      console.error("Could not save session:", error);
    }

    setUser(userData);
    setRole(userData.role);
    setTab("dashboard");
    setMobileOpen(false);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);

    localStorage.removeItem("waterUser");
    localStorage.removeItem("waterToken");
    localStorage.removeItem("waterHouseholdId");
    localStorage.removeItem("waterActiveTab");

    setUser(null);
    setRole(null);
    setTab("dashboard");
    setMobileOpen(false);
  }

  if (!user || !role) {
    return <Landing onLogin={handleLogin} />;
  }

  const pageInfo = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Monitor your household water consumption.",
    },
    consumption: {
      title: "My Consumption",
      subtitle: "Review your recorded household water consumption.",
    },
    forecast: {
      title: "Forecast",
      subtitle: "Estimated future water consumption based on your records.",
    },
    tips: {
      title: "Water-Saving Tips",
      subtitle: "Recommendations to reduce water consumption.",
    },
    households: {
      title: "Households",
      subtitle: "Manage registered households.",
    },
    data: {
      title: "Data Management",
      subtitle: "Manage water consumption records.",
    },
    forecasting: {
      title: "Forecasting Management",
      subtitle: "Manage household consumption forecasts.",
    },
    reports: {
      title: "Reports",
      subtitle: "Generate system reports.",
    },
    users: {
      title: "Users Management",
      subtitle: "Manage system users.",
    },
    settings: {
      title: "System Settings",
      subtitle: "Configure system settings.",
    },
  };

  const allowedTabs =
    role === "admin"
      ? adminNav.map(([id]) => id)
      : residentNav.map(([id]) => id);

  const visibleTab = allowedTabs.includes(tab) ? tab : "dashboard";
  const currentPage = pageInfo[visibleTab] || pageInfo.dashboard;

  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        tab={visibleTab}
        setTab={setTab}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="main">
        <Topbar
          role={role}
          setMobileOpen={setMobileOpen}
          apiOk={apiOk}
        />

        <main className="content">
          {visibleTab !== "dashboard" && (
            <div className="page-head">
              <h1>{currentPage.title}</h1>
              <p>{currentPage.subtitle}</p>
            </div>
          )}

          {role === "resident" && visibleTab === "dashboard" && (
            <Dashboard />
          )}

          {role === "resident" && visibleTab === "consumption" && (
            <Consumption />
          )}

          {role === "resident" && visibleTab === "forecast" && (
            <Forecast />
          )}

          {/* Use the separate recommendation page, not static tips. */}
          {role === "resident" && visibleTab === "tips" && (
            <Recommendation />
          )}

          {role === "admin" && <AdminPage tab={visibleTab} />}
        </main>
      </div>
    </div>
  );
}
