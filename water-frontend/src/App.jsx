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

const API = "http://localhost:4000";

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
  ["forecasting", "Forecasting", TrendingUp],
  ["reports", "Reports", FileText],
  ["users", "Users", Users],
  ["settings", "System Settings", Settings],
];

function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}

// ============================================================
// SECTION 1: LOGIN AND SIGNUP
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

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function switchMode(newMode) {
    setMode(newMode);
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    clearMessages();
  }

  // LOGIN: Authenticate against the backend.
  async function handleLogin(e) {
    e.preventDefault();
    clearMessages();

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

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        setError(
          response.status === 401 || response.status === 403
            ? "Incorrect username or password."
            : data.message ||
                data.error ||
                "Unable to log in. Please try again."
        );
        return;
      }

      if (!data.user || !["admin", "resident"].includes(data.user.role)) {
        setError("The server did not return valid user information.");
        return;
      }

      onLogin({
        ...data.user,
        token: data.token ?? data.user.token ?? null,
        householdId:
          data.householdId ?? data.user.householdId ?? null,
      });
    } catch (err) {
      console.error("Login request failed:", err);

      setError(
        "Cannot connect to the server. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  // SIGNUP: Register a new resident account.
  async function handleSignup(e) {
    e.preventDefault();
    clearMessages();

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

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        setError(
          data.message ||
            data.error ||
            (response.status === 409
              ? "Username already exists."
              : "Unable to create account.")
        );
        return;
      }

      setMode("login");
      setUsername(cleanUsername);
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setSuccess("Account created successfully! Please sign in.");
    } catch (err) {
      console.error("Registration request failed:", err);

      setError(
        "Cannot connect to the server. Make sure the backend is running."
      );
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
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                disabled={loading}
                required
              />

              <label htmlFor="login-password">Password</label>

              <div className="password-field">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>

              {error && (
                <div className="login-error" role="alert">
                  {error}
                </div>
              )}

              {success && (
                <div className="login-success" role="status">
                  {success}
                </div>
              )}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
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
              Create a homeowner account to monitor your household water
              consumption.
            </p>

            <form className="login-form" onSubmit={handleSignup}>
              <label htmlFor="signup-username">Username</label>

              <input
                id="signup-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                autoComplete="username"
                disabled={loading}
                minLength={3}
                required
              />

              <label htmlFor="signup-password">Password</label>

              <div className="password-field">
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  disabled={loading}
                  minLength={4}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>

              <label htmlFor="signup-confirm">Confirm Password</label>

              <div className="password-field">
                <input
                  id="signup-confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  disabled={loading}
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>

              {error && (
                <div className="login-error" role="alert">
                  {error}
                </div>
              )}

              {success && (
                <div className="login-success" role="status">
                  {success}
                </div>
              )}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
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
// SECTION 2: SIDEBAR
// ============================================================
function Sidebar({
  role,
  tab,
  setTab,
  onLogout,
  mobileOpen,
  setMobileOpen,
}) {
  const nav = role === "admin" ? adminNav : residentNav;

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation menu"
          onClick={() => setMobileOpen(false)}
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
              {role === "admin"
                ? "Administrator Portal"
                : "Homeowner Portal"}
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

        {nav.map(([id, label, Icon]) => (
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
// SECTION 3: TOPBAR
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
// SECTION 4: WATER-SAVING TIPS
// ============================================================
function Tips() {
  const tips = [
    {
      title: "Turn Off the Tap",
      text: "Turn off the tap while brushing your teeth.",
      icon: Droplets,
    },
    {
      title: "Fix Water Leaks",
      text: "Fix leaking faucets and pipes immediately.",
      icon: Settings,
    },
    {
      title: "Use Full Loads",
      text: "Use washing machines only with full loads.",
      icon: Database,
    },
    {
      title: "Take Shorter Showers",
      text: "Take shorter showers to reduce water usage.",
      icon: Droplets,
    },
    {
      title: "Reuse Water",
      text: "Reuse suitable water for cleaning or plants.",
      icon: Lightbulb,
    },
  ];

  return (
    <Card className="tips-card">
      <div className="tips-heading">
        <div className="tips-heading-icon">
          <Lightbulb size={21} />
        </div>

        <div>
          <div className="card-title">Water-Saving Recommendations</div>
          <p className="muted">
            Simple ways to reduce household water consumption.
          </p>
        </div>
      </div>

      <div className="tips-list">
        {tips.map((tip, index) => {
          const Icon = tip.icon;

          return (
            <div className="tip-row" key={tip.title}>
              <div className="tip-number">{index + 1}</div>
              <div className="tip-icon">
                <Icon size={18} />
              </div>
              <div className="tip-content">
                <strong>{tip.title}</strong>
                <p>{tip.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ============================================================
// SECTION 5: ADMIN PAGES
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

  if (!page) {
    return (
      <Card>
        <div className="card-title">Administrator Dashboard</div>
        <p className="muted">Welcome to the administration portal.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="card-title">{page.title}</div>
      <p className="muted">{page.description}</p>
    </Card>
  );
}

// ============================================================
// SECTION 6: MAIN APP
// ============================================================
function App() {
  // CHANGE 1:
  // Do NOT restore the role from localStorage.
  // Every full page reload starts with role = null,
  // which displays the login page.
  const [role, setRole] = useState(null);

  // CHANGE 2:
  // Always initialize the tab to Dashboard.
  // The user must log in before seeing any application page.
  const [tab, setTab] = useState("dashboard");

  const [mobileOpen, setMobileOpen] = useState(false);
  const [apiOk, setApiOk] = useState(false);

  // SECTION 6A: Check whether the backend is available.
  useEffect(() => {
    let active = true;

    async function checkBackend() {
      try {
        const response = await fetch(`${API}/api/health`);

        if (!response.ok) {
          throw new Error("Health check failed");
        }

        if (active) {
          setApiOk(true);
        }
      } catch {
        if (active) {
          setApiOk(false);
        }
      }
    }

    checkBackend();

    const intervalId = window.setInterval(checkBackend, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  // SECTION 6B: Login handler.
  // Save session information for other app features, but do not
  // restore the role from storage when the page reloads.
  function handleLogin(user) {
    // CHANGE 3: Save the authenticated user's information.
    localStorage.setItem("waterUser", JSON.stringify(user));

    if (user.token) {
      localStorage.setItem("waterToken", user.token);
    } else {
      localStorage.removeItem("waterToken");
    }

    if (user.householdId != null) {
      localStorage.setItem(
        "waterHouseholdId",
        String(user.householdId)
      );
    } else {
      localStorage.removeItem("waterHouseholdId");
    }

    localStorage.setItem("waterActiveTab", "dashboard");

    setTab("dashboard");
    setMobileOpen(false);

    // This state exists only for the current page session.
    setRole(user.role);
  }

  // SECTION 6C: Logout handler.
  function handleLogout() {
    localStorage.removeItem("waterUser");
    localStorage.removeItem("waterToken");
    localStorage.removeItem("waterHouseholdId");
    localStorage.removeItem("waterActiveTab");

    setMobileOpen(false);
    setTab("dashboard");
    setRole(null);
  }

  // CHANGE 4:
  // Show login whenever there is no role in the current React session.
  // After a refresh, role starts as null, so this page appears.
  if (!role) {
    return <Landing onLogin={handleLogin} />;
  }

  // SECTION 6D: Page titles and descriptions.
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
      subtitle:
        "Estimated future water consumption based on your records.",
    },
    tips: {
      title: "Water-Saving Tips",
      subtitle: "Recommendations to help reduce water consumption.",
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

  // SECTION 6E: Restrict navigation according to the user's role.
  const allowedTabs =
    role === "admin"
      ? adminNav.map(([id]) => id)
      : residentNav.map(([id]) => id);

  const visibleTab = allowedTabs.includes(tab) ? tab : "dashboard";
  const currentPage = pageInfo[visibleTab] || pageInfo.dashboard;

  // SECTION 6F: Main application layout.
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
          {/* CHANGE 5:
              Dashboard and Forecast already have their own page headers. */}
          {visibleTab !== "dashboard" && visibleTab !== "forecast" && (
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

          {role === "resident" && visibleTab === "tips" && <Tips />}

          {role === "admin" && <AdminPage tab={visibleTab} />}
        </main>
      </div>
    </div>
  );
}

export default App;