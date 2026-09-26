import { useState } from "react";

function Login({ onLogin }) {
  const [role, setRole] = useState("homeowner");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();

    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter your username and password.");
      return;
    }

    // Temporary frontend login
    // Replace with database/API authentication later.
    if (role === "homeowner") {
      if (
        username === "homeowner" &&
        password === "1234"
      ) {
        onLogin("homeowner");
      } else {
        setError(
          "Invalid homeowner account. Try homeowner / 1234"
        );
      }
    }

    if (role === "admin") {
      if (
        username === "admin" &&
        password === "1234"
      ) {
        onLogin("admin");
      } else {
        setError(
          "Invalid admin account. Try admin / 1234"
        );
      }
    }
  }

  return (
    <div className="login-page">

      <div className="login-background-circle circle-one"></div>
      <div className="login-background-circle circle-two"></div>

      <div className="login-card">

        <div className="login-logo">
          💧
        </div>

        <h1>
          Water Monitoring System
        </h1>

        <p className="login-subtitle">
          Smart household water consumption monitoring
        </p>

        <div className="login-role-buttons">

          <button
            type="button"
            className={
              role === "homeowner"
                ? "login-role active"
                : "login-role"
            }
            onClick={() => {
              setRole("homeowner");
              setError("");
            }}
          >
            Homeowner
          </button>

          <button
            type="button"
            className={
              role === "admin"
                ? "login-role active"
                : "login-role"
            }
            onClick={() => {
              setRole("admin");
              setError("");
            }}
          >
            Admin
          </button>

        </div>

        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label>
              Username
            </label>

            <input
              type="text"
              placeholder={
                role === "admin"
                  ? "Enter admin username"
                  : "Enter homeowner username"
              }
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
            />
          </div>

          <div className="form-group">
            <label>
              Password
            </label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
          >
            Login as{" "}
            {role === "admin"
              ? "Admin"
              : "Homeowner"}
          </button>

        </form>

        <div className="login-demo">
          <strong>Demo account</strong>

          <span>
            {role === "admin"
              ? "admin / 1234"
              : "homeowner / 1234"}
          </span>
        </div>

      </div>

    </div>
  );
}

export default Login;