import { NavLink, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="shell">
      <nav className="topnav" aria-label="Primary">
        <div className="topnav-inner">
          <NavLink to="/" end className={({ isActive }) => `topnav-link ${isActive ? "active" : ""}`}>
            Chat
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => `topnav-link ${isActive ? "active" : ""}`}>
            Admin
          </NavLink>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
