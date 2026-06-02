import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Activity, BrainCircuit, History, Lightbulb, HeartPulse, Radio, Sun, Moon, GitCompareArrows } from "lucide-react";
import { useTheme } from "@/lib/theme";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/current", label: "Current Prediction", icon: Activity, testid: "nav-current" },
  { to: "/future", label: "Future Forecasting", icon: BrainCircuit, testid: "nav-future" },
  { to: "/compare", label: "Compare", icon: GitCompareArrows, testid: "nav-compare" },
  { to: "/history", label: "Network History", icon: History, testid: "nav-history" },
  { to: "/recommendations", label: "Recommendations", icon: Lightbulb, testid: "nav-recommendations" },
  { to: "/health", label: "System Health", icon: HeartPulse, testid: "nav-health" },
];

export default function AppLayout() {
  const { theme, toggle } = useTheme();
  return (
    <div className="flex min-h-screen text-app">
      {/* Sidebar */}
      <aside
        className="w-60 shrink-0 flex flex-col surface-bg"
        style={{ borderRight: "1px solid var(--border)" }}
        data-testid="app-sidebar"
      >
        <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-cyan-app" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-app">NetTwin</div>
              <div className="font-mono-data text-sm font-semibold text-app">NOC.AI · v1.0</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5" data-testid="sidebar-nav">
          {NAV.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={testid}
              style={({ isActive }) => isActive ? { color: "var(--cyan)", background: "var(--cyan-soft)", borderLeft: "2px solid var(--cyan)" } : { borderLeft: "2px solid transparent" }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  isActive ? "" : "text-muted-app hover:text-app hover:bg-[var(--surface-2)]"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            data-testid="theme-toggle"
            onClick={toggle}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-mono-data uppercase tracking-widest text-muted-app hover:text-app hover:bg-[var(--surface-2)] transition-colors"
          >
            <span className="flex items-center gap-2">
              {theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {theme === "dark" ? "Dark" : "Light"}
            </span>
            <span className="text-[10px]">Switch</span>
          </button>
          <div className="mt-2 flex items-center gap-2 px-3 text-[10px] uppercase tracking-widest text-muted2-app font-mono-data">
            <span className="status-dot" style={{ background: "var(--emerald)" }} />
            <span>LSTM Online</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 px-8 py-6 bg-grid" data-testid="app-main">
        <Outlet />
      </main>
    </div>
  );
}
