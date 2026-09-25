import * as React from "react";
import { NavLink } from "react-router";
import { cn } from "@/lib/cn";
import type { NavItem } from "./AppShell";

export const AdminSidebarNav: React.FC<{
  groups: { heading?: string; items: NavItem[] }[];
  onNavigate?: () => void;
  endMatchers?: Record<string, boolean>;
}> = ({ groups, onNavigate, endMatchers = {} }) => (
  <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
    {groups.map((group, gi) => (
      <div key={group.heading ?? gi} className="flex flex-col gap-1">
        {group.heading ? (
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {group.heading}
          </p>
        ) : null}
        {group.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={endMatchers[item.to]}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    ))}
  </nav>
);
