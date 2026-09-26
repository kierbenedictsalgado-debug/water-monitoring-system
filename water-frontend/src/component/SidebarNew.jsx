import {
  Home,
  Droplets,
  BarChart3,
  TrendingUp,
  Lightbulb,
  Users,
  FileText
} from "lucide-react";

function Sidebar({
  role = "homeowner",
  page,
  setPage
}) {

  const homeownerMenu = [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: Home
    },
    {
      id: "consumption",
      name: "My Consumption",
      icon: Droplets
    },
    {
      id: "analytics",
      name: "Analytics",
      icon: BarChart3
    },
    {
      id: "forecast",
      name: "Forecast",
      icon: TrendingUp
    },
    {
      id: "recommendation",
      name: "Recommendations",
      icon: Lightbulb
    }
  ];

  const adminMenu = [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: Home
    },
    {
      id: "households",
      name: "Households",
      icon: Users
    },
    {
      id: "consumption",
      name: "Consumption",
      icon: Droplets
    },
    {
      id: "forecast",
      name: "Forecast",
      icon: TrendingUp
    },
    {
      id: "reports",
      name: "Reports",
      icon: FileText
    }
  ];

  const menu =
    role === "admin"
      ? adminMenu
      : homeownerMenu;

  return (
    <aside className="sidebar">

      <div className="sidebar-logo">

        <div className="logo-icon">
          💧
        </div>

        <div>
          <h2>Water System</h2>

          <p>
            {role === "admin"
              ? "Admin Portal"
              : "Homeowner Portal"}
          </p>
        </div>

      </div>

      <div className="sidebar-title">
        MENU
      </div>

      <nav className="sidebar-nav">

        {menu.map((item) => {

          const Icon = item.icon;

          const isActive =
            page === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={
                isActive
                  ? "sidebar-item active"
                  : "sidebar-item"
              }
              onClick={() => setPage(item.id)}
            >

              <Icon size={20} />

              <span>
                {item.name}
              </span>

            </button>
          );
        })}

      </nav>

    </aside>
  );
}

export default Sidebar;