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
import Forecast from "./Pages/Homeowner/Forecast";

const API = "http://localhost:4000";

// RESIDENT NAVIGATION

const residentNav = [
  ["dashboard", "Dashboard", Home],
  ["consumption", "My Consumption", Droplets],
  ["forecast", "Forecast", TrendingUp],
  ["tips", "Water-Saving Tips", Lightbulb],
];

// ADMIN NAVIGATION

const adminNav = [
  ["dashboard", "Dashboard", Home],
  ["households", "Households", Users],
  ["data", "Data Management", Database],
  ["forecasting", "Forecasting", TrendingUp],
  ["reports", "Reports", FileText],
  ["users", "Users", Users],
  ["settings", "System Settings", Settings],
];

// CARD

function Card({ children, className = "" }) {
  return (
    <div className={`card ${className}`}>
      {children}
    </div>
  );
}

// LOGIN AND SIGN UP

function Landing({ onLogin }) {
  const [mode, setMode] = useState("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const switchMode = (newMode) => {
    setMode(newMode);

    setUsername("");
    setPassword("");
    setConfirmPassword("");

    setShowPassword(false);
    setShowConfirmPassword(false);

    clearMessages();
  };

  // LOGIN PAGE

  const handleLogin = async (e) => {
    e.preventDefault();

    clearMessages();

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setError("Please enter your username.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
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

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      // WRONG USERNAME OR PASSWORD

      if (response.status === 401 || response.status === 403) {
        setError("Incorrect username or password.");
        return;
      }

      if (!response.ok) {
        setError(
          data.message ||
            data.error ||
            "Incorrect username or password."
        );
        return;
      }

      // CHECK LOGIN RESPONSE

      if (!data.user) {
        setError("Incorrect username or password.");
        return;
      }

      if (!data.user.role) {
        setError("Login failed: user role was not provided.");
        return;
      }

      // LOGIN SUCCESS

      onLogin(data.user);

    } catch (err) {
      console.error("Login error:", err);

      // ONLY SHOW THIS WHEN SERVER CANNOT BE REACHED

      if (
        err.name === "TypeError" ||
        err.message === "Failed to fetch"
      ) {
        setError(
          "Cannot connect to the server. Please make sure the backend is running."
        );
      } else {
        setError(
          "Unable to log in. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // SIGN UP PAGE

  const handleSignup = async (e) => {
    e.preventDefault();

    clearMessages();

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setError("Please enter a username.");
      return;
    }

    if (cleanUsername.length < 3) {
      setError(
        "Username must be at least 3 characters."
      );
      return;
    }

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

    if (!confirmPassword) {
      setError(
        "Please confirm your password."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
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

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      // USERNAME ALREADY EXISTS

      if (response.status === 409) {
        setError(
          data.message ||
            "Username already exists. Please choose another username."
        );
        return;
      }

      if (!response.ok) {
        setError(
          data.message ||
            data.error ||
            "Unable to create account."
        );
        return;
      }

      // ACCOUNT CREATED

      setSuccess(
        "Account created successfully! Please sign in."
      );

      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        setMode("login");
        setError("");
        setSuccess(
          "Account created successfully. Please sign in."
        );
      }, 1200);

    } catch (err) {
      console.error(
        "Registration error:",
        err
      );

      if (
        err.name === "TypeError" ||
        err.message === "Failed to fetch"
      ) {
        setError(
          "Cannot connect to the server. Please make sure the backend is running."
        );
      } else {
        setError(
          "Unable to create account. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing">

      <div className="login-card">

        {/* APP ICON */}

        <div className="login-logo">
          <Droplets size={34} />
        </div>

        {/* SYSTEM TITLE */}

        <h1>
          Water Monitoring System
        </h1>

        <p className="login-subtitle">
          Smart household water consumption monitoring
        </p>

        {/* LOGIN PAGE */}

        {mode === "login" && (
          <>
            <div className="landing-heading">
              Welcome Back
            </div>

            <p className="landing-description">
              Sign in to monitor your household water
              consumption.
            </p>

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

                {/* SHOW / HIDE PASSWORD */}

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

              {/* LOGIN ERROR */}

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              {/* LOGIN SUCCESS */}

              {success && (
                <div className="login-success">
                  {success}
                </div>
              )}

              {/* LOGIN BUTTON */}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading
                  ? "Signing in..."
                  : "Sign In"}
              </button>

            </form>

            {/* GO TO SIGN UP */}

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

        {/* SIGN UP PAGE */}

        {mode === "signup" && (
          <>
            <div className="landing-heading">
              Create Your Account
            </div>

            <p className="landing-description">
              Create a simple homeowner account to
              monitor your household water consumption.
            </p>

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

                {/* SHOW / HIDE PASSWORD */}

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

              {/* CONFIRM PASSWORD */}

              <label htmlFor="signup-confirm">
                Confirm Password
              </label>

              <div className="password-field">

                <input
                  id="signup-confirm"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  disabled={loading}
                />

                {/* SHOW / HIDE CONFIRM PASSWORD */}

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>

              </div>

              {/* SIGN UP ERROR */}

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              {/* SIGN UP SUCCESS */}

              {success && (
                <div className="login-success">
                  {success}
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

            {/* GO TO LOGIN */}

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
                Sign In
              </button>

            </div>
          </>
        )}

      </div>

    </div>
  );
}

// SIDEBAR

function Sidebar({
  role,
  tab,
  setTab,
  onLogout,
  mobileOpen,
  setMobileOpen,
}) {
  const nav =
    role === "admin"
      ? adminNav
      : residentNav;

  return (
    <aside
      className={`sidebar ${
        mobileOpen ? "open" : ""
      }`}
    >

      {/* BRAND */}

      <div className="side-brand">

        <div className="brand-drop small">
          <Droplets size={20} />
        </div>

        <div className="brand-text">

          <div className="brand-name">
            Water Monitoring
          </div>

          <div className="side-tag">
            {role === "admin"
              ? "Administrator Portal"
              : "Homeowner Portal"}
          </div>

        </div>

        {/* MOBILE CLOSE */}

        <button
          type="button"
          className="mobile-close"
          onClick={() =>
            setMobileOpen(false)
          }
        >
          <X size={18} />
        </button>

      </div>

      {/* MENU */}

      <div className="menu-label">
        MENU
      </div>

      {nav.map(
        ([id, label, Icon]) => (
          <button
            type="button"
            key={id}
            className={`nav-item ${
              tab === id
                ? "active"
                : ""
            }`}
            onClick={() => {
              setTab(id);
              setMobileOpen(false);
            }}
          >
            <Icon size={17} />

            <span>
              {label}
            </span>
          </button>
        )
      )}

      {/* LOGOUT */}

      <div className="sidebar-bottom">

        <button
          type="button"
          className="nav-item"
          onClick={onLogout}
        >
          <LogOut size={17} />

          <span>
            Logout
          </span>
        </button>

      </div>

    </aside>
  );
}

// TOPBAR

function Topbar({
  role,
  setMobileOpen,
  apiOk,
}) {
  return (
    <header className="topbar">

      {/* MOBILE MENU */}

      <button
        type="button"
        className="menu-button"
        onClick={() =>
          setMobileOpen(true)
        }
      >
        <Menu size={20} />
      </button>

      {/* BREADCRUMB */}

      <div className="breadcrumb">
        {role === "admin"
          ? "Administrator Portal"
          : "Homeowner Portal"}
      </div>

      {/* TOP ACTIONS */}

      <div className="top-actions">

        {/* API STATUS */}

        <div
          className={`api-status ${
            apiOk
              ? "connected"
              : ""
          }`}
        >
          <span></span>

          {apiOk
            ? "API Connected"
            : "API Offline"}
        </div>

        {/* NOTIFICATION */}

        <button
          type="button"
          className="icon-button"
        >
          <Bell size={18} />
        </button>

        {/* AVATAR */}

        <div className="avatar">
          {role === "admin"
            ? "AD"
            : "HO"}
        </div>

      </div>

    </header>
  );
}

// DASHBOARD

function Dashboard() {
  const records = JSON.parse(
    localStorage.getItem(
      "waterConsumptionRecords"
    ) || "[]"
  );

  const consumption =
    records.length > 0
      ? records[0].consumption
      : 0;

  const total =
    records.reduce(
      (sum, record) =>
        sum +
        Number(
          record.consumption || 0
        ),
      0
    );

  const average =
    records.length > 0
      ? total / records.length
      : 0;

  return (
    <div>

      {/* DASHBOARD STATISTICS */}

      <div className="stats-grid">

        {/* TOTAL CONSUMPTION */}

        <Card className="stat-card">

          <div className="stat-icon aqua">
            <Droplets size={19} />
          </div>

          <div className="stat-label">
            Total Consumption
          </div>

          <div className="stat-value">
            {total.toFixed(1)}

            <small>
              {" "}m³
            </small>
          </div>

        </Card>

        {/* AVERAGE CONSUMPTION */}

        <Card className="stat-card">

          <div className="stat-icon green">
            <TrendingUp size={19} />
          </div>

          <div className="stat-label">
            Average Consumption
          </div>

          <div className="stat-value">
            {average.toFixed(1)}

            <small>
              {" "}m³
            </small>
          </div>

        </Card>

        {/* RECORDS */}

        <Card className="stat-card">

          <div className="stat-icon violet">
            <Database size={19} />
          </div>

          <div className="stat-label">
            Records
          </div>

          <div className="stat-value">
            {records.length}
          </div>

        </Card>

        {/* LATEST CONSUMPTION */}

        <Card className="stat-card">

          <div className="stat-icon rose">
            <Bell size={19} />
          </div>

          <div className="stat-label">
            Latest Consumption
          </div>

          <div className="stat-value">
            {Number(
              consumption
            ).toFixed(1)}

            <small>
              {" "}m³
            </small>
          </div>

        </Card>

      </div>

      {/* DASHBOARD WELCOME */}

      <Card>

        <div className="card-title">
          Welcome to the Water Monitoring System
        </div>

        <p className="muted">
          Monitor your household water
          consumption, save actual water
          bills, and view your consumption
          forecast.
        </p>

      </Card>

    </div>
  );
}

// WATER-SAVING TIPS

function Tips() {
  const tips = [
    {
      title: "Turn Off the Tap",
      text:
        "Turn off the tap while brushing your teeth.",
      icon: Droplets,
    },
    {
      title: "Fix Water Leaks",
      text:
        "Fix leaking faucets and pipes immediately.",
      icon: Settings,
    },
    {
      title: "Use Full Loads",
      text:
        "Use washing machines only with full loads.",
      icon: Database,
    },
    {
      title: "Take Shorter Showers",
      text:
        "Take shorter showers to reduce water usage.",
      icon: Droplets,
    },
    {
      title: "Reuse Water",
      text:
        "Reuse suitable water for cleaning or plants.",
      icon: Lightbulb,
    },
  ];

  return (
    <Card className="tips-card">

      {/* TIPS HEADER */}

      <div className="tips-heading">

        <div className="tips-heading-icon">
          <Lightbulb size={21} />
        </div>

        <div>

          <div className="card-title">
            Water-Saving Recommendations
          </div>

          <p className="muted">
            Simple ways to reduce household
            water consumption.
          </p>

        </div>

      </div>

      {/* TIPS LIST */}

      <div className="tips-list">

        {tips.map(
          (tip, index) => {
            const Icon = tip.icon;

            return (
              <div
                className="tip-row"
                key={index}
              >

                <div className="tip-number">
                  {index + 1}
                </div>

                <div className="tip-icon">
                  <Icon size={18} />
                </div>

                <div className="tip-content">

                  <strong>
                    {tip.title}
                  </strong>

                  <p>
                    {tip.text}
                  </p>

                </div>

              </div>
            );
          }
        )}

      </div>

    </Card>
  );
}

// ADMIN PAGE

function AdminPage({ tab }) {

  // HOUSEHOLDS

  if (tab === "households") {
    return (
      <Card>

        <div className="card-title">
          Households
        </div>

        <p className="muted">
          Manage registered household
          information.
        </p>

      </Card>
    );
  }

  // DATA MANAGEMENT

  if (tab === "data") {
    return (
      <Card>

        <div className="card-title">
          Data Management
        </div>

        <p className="muted">
          Manage household water
          consumption records.
        </p>

      </Card>
    );
  }

  // FORECASTING

  if (tab === "forecasting") {
    return (
      <Card>

        <div className="card-title">
          Forecasting Management
        </div>

        <p className="muted">
          Review water consumption
          forecasting information.
        </p>

      </Card>
    );
  }

  // REPORTS

  if (tab === "reports") {
    return (
      <Card>

        <div className="card-title">
          Reports
        </div>

        <p className="muted">
          Generate consumption and
          forecasting reports.
        </p>

      </Card>
    );
  }

  // USERS

  if (tab === "users") {
    return (
      <Card>

        <div className="card-title">
          Users Management
        </div>

        <p className="muted">
          Manage homeowner and
          administrator accounts.
        </p>

      </Card>
    );
  }

  // SYSTEM SETTINGS

  if (tab === "settings") {
    return (
      <Card>

        <div className="card-title">
          System Settings
        </div>

        <p className="muted">
          Configure system settings.
        </p>

      </Card>
    );
  }

  return <Dashboard />;
}

// MAIN APP

function App() {
  const [role, setRole] = useState(null);

  const [tab, setTab] =
    useState("dashboard");

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [apiOk, setApiOk] =
    useState(false);

  // CHECK BACKEND CONNECTION

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(
          `${API}/api/health`
        );

        if (!response.ok) {
          throw new Error();
        }

        setApiOk(true);
      } catch {
        setApiOk(false);
      }
    };

    checkBackend();
  }, []);

  // LOGIN SCREEN

  if (!role) {
    return (
      <Landing
        onLogin={(user) => {
          setRole(user.role);
          setTab("dashboard");
        }}
      />
    );
  }

  // PAGE TITLE

  let title = "Dashboard";

  let subtitle =
    "Monitor your household water consumption.";

  // HOMEOWNER PAGE TITLES

  if (role === "resident") {

    if (tab === "consumption") {
      title = "My Consumption";

      subtitle =
        "Record and manage your actual water bills.";
    }

    if (tab === "forecast") {
      title = "Forecast";

      subtitle =
        "Estimated future water consumption based on your records.";
    }

    if (tab === "tips") {
      title = "Water-Saving Tips";

      subtitle =
        "Recommendations to help reduce water consumption.";
    }
  }

  // ADMIN PAGE TITLES

  else {

    if (tab === "households") {
      title = "Households";

      subtitle =
        "Manage registered households.";
    }

    if (tab === "data") {
      title = "Data Management";

      subtitle =
        "Manage water consumption records.";
    }

    if (tab === "forecasting") {
      title = "Forecasting Management";

      subtitle =
        "Manage household consumption forecasts.";
    }

    if (tab === "reports") {
      title = "Reports";

      subtitle =
        "Generate system reports.";
    }

    if (tab === "users") {
      title = "Users Management";

      subtitle =
        "Manage system users.";
    }

    if (tab === "settings") {
      title = "System Settings";

      subtitle =
        "Configure system settings.";
    }
  }

  return (
    <div className="app-shell">

      {/* SIDEBAR */}

      <Sidebar
        role={role}
        tab={tab}
        setTab={setTab}
        onLogout={() => {
          setRole(null);
          setTab("dashboard");
          setMobileOpen(false);
        }}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="main">

        {/* TOPBAR */}

        <Topbar
          role={role}
          setMobileOpen={setMobileOpen}
          apiOk={apiOk}
        />

        <main className="content">

          {/* PAGE HEADER */}

          <div className="page-head">

            <h1>
              {title}
            </h1>

            <p>
              {subtitle}
            </p>

          </div>

          {/* HOMEOWNER DASHBOARD */}

          {role === "resident" &&
            tab === "dashboard" && (
              <Dashboard />
            )}

          {/* HOMEOWNER CONSUMPTION */}

          {role === "resident" &&
            tab === "consumption" && (
              <Consumption />
            )}

          {/* HOMEOWNER FORECAST */}

          {role === "resident" &&
            tab === "forecast" && (
              <Forecast />
            )}

          {/* WATER-SAVING TIPS */}

          {role === "resident" &&
            tab === "tips" && (
              <Tips />
            )}

          {/* ADMIN PAGES */}

          {role === "admin" && (
            <AdminPage
              tab={tab}
            />
          )}

        </main>

      </div>

    </div>
  );
}

export default App;