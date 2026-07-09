import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  ChevronDown,
  ChevronRight,
  Users,
  CalendarX,
} from "lucide-react";

const divisions = [
  { key: "hotd1", label: "HOTD 1", path: "/projects/hotd1" },
  { key: "hotd2-finance", label: "HOTD 2 - Finance", path: "/projects/hotd2-finance" },
  { key: "hotd2-nonfinance", label: "HOTD 2 - Non-Finance", path: "/projects/hotd2-nonfinance" },
];

export default function Sidebar() {
  const location = useLocation();
  const isProjectsActive = location.pathname.startsWith("/projects");
  const [projectsExpanded, setProjectsExpanded] = useState(isProjectsActive);

  return (
    <aside className="w-64 h-screen sticky top-0 bg-canvas border-r border-hairline-soft flex flex-col">
      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-brand-yellow rounded-lg flex items-center justify-center">
          <span className="text-primary font-bold text-sm">P</span>
        </div>
        <span className="font-semibold text-[15px] text-ink tracking-tight">PMO Tool</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {/* Dashboard */}
        <NavItem to="/dashboard" icon={<LayoutDashboard size={18} />}>
          Dashboard
        </NavItem>

        {/* Projects (expandable) */}
        <div>
          <button
            onClick={() => setProjectsExpanded((v) => !v)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
              ${isProjectsActive ? "text-ink bg-surface" : "text-slate hover:text-ink hover:bg-surface"}`}
          >
            <FolderKanban size={18} />
            <span className="flex-1 text-left">Projects</span>
            {projectsExpanded ? (
              <ChevronDown size={15} className="text-stone" />
            ) : (
              <ChevronRight size={15} className="text-stone" />
            )}
          </button>

          {projectsExpanded && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-hairline pl-2">
              {divisions.map((d) => (
                <NavLink
                  key={d.key}
                  to={d.path}
                  className={({ isActive }) =>
                    `block px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors
                    ${isActive ? "text-brand-blue bg-blue-50" : "text-slate hover:text-ink hover:bg-surface"}`
                  }
                >
                  {d.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Team Members */}
        <NavItem to="/team-members" icon={<Users size={18} />}>
          Team Members
        </NavItem>

        {/* Holidays */}
        <NavItem to="/holidays" icon={<CalendarX size={18} />}>
          Holidays
        </NavItem>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-hairline-soft">
        <p className="text-[11px] text-stone font-medium uppercase tracking-wider">
          PMO Workflow v0.1
        </p>
      </div>
    </aside>
  );
}

function NavItem({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
        ${isActive ? "text-ink bg-surface" : "text-slate hover:text-ink hover:bg-surface"}`
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}
