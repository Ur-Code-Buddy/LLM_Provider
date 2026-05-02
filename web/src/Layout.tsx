import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { APP_NAME, APP_TAGLINE, pageTitleForPath } from "./brand";

export function Layout() {
  const location = useLocation();

  useEffect(() => {
    document.title = pageTitleForPath(location.pathname);
  }, [location.pathname]);

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-header-inner">
          <Link to="/" className="brand-lockup">
            <span className="brand-mark" aria-hidden />
            <div className="brand-text">
              <div className="brand-name">{APP_NAME}</div>
              <div className="brand-tagline">{APP_TAGLINE}</div>
            </div>
          </Link>
          <nav className="topnav" aria-label="Main">
            <div className="topnav-inner">
              <NavLink to="/" end className={({ isActive }) => `topnav-link ${isActive ? "active" : ""}`}>
                Workspace
              </NavLink>
              <NavLink to="/admin" className={({ isActive }) => `topnav-link ${isActive ? "active" : ""}`}>
                Administration
              </NavLink>
            </div>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
