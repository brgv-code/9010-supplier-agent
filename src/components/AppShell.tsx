import { useAuthActions } from "@convex-dev/auth/react";
import { Link, Outlet } from "@tanstack/react-router";

export default function AppShell() {
  const { signOut } = useAuthActions();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">90/10</span>
          <span className="brand-sub">supplier agent</span>
        </div>
        <nav>
          <Link
            to="/"
            className="navlink"
            activeProps={{ className: "navlink active" }}
            activeOptions={{ exact: true }}
          >
            Tenders
          </Link>
          <Link to="/suppliers" className="navlink" activeProps={{ className: "navlink active" }}>
            Suppliers
          </Link>
        </nav>
        <button type="button" className="linkbtn signout" onClick={() => void signOut()}>
          Sign out
        </button>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
