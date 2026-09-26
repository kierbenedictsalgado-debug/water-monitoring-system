function Header({
  role = "homeowner",
  onLogout,
  onRoleChange
}) {
  const isAdmin = role === "admin";

  return (
    <header className="header">

      <div className="header-left">

        <div className="header-logo">
          💧
        </div>

        <div>
          <div className="header-title">
            Water Monitoring System
          </div>

          <div className="header-subtitle">
            Smart water consumption monitoring
          </div>
        </div>

      </div>

      <div className="header-right">

        <div className="header-role-buttons">

          <button
            className={
              !isAdmin
                ? "header-role active"
                : "header-role"
            }
            onClick={() => onRoleChange("homeowner")}
          >
            Homeowner
          </button>

          <button
            className={
              isAdmin
                ? "header-role active"
                : "header-role"
            }
            onClick={() => onRoleChange("admin")}
          >
            Admin
          </button>

        </div>

        <div className="header-user">

          <div className="header-avatar">
            {isAdmin ? "A" : "H"}
          </div>

          <div className="header-user-info">

            <div className="header-user-name">
              {isAdmin ? "Administrator" : "Homeowner"}
            </div>

            <div className="header-user-role">
              {isAdmin
                ? "Admin Portal"
                : "Homeowner Portal"}
            </div>

          </div>

        </div>

        <button
          className="logout-button"
          onClick={onLogout}
        >
          Logout
        </button>

      </div>

    </header>
  );
}

export default Header;