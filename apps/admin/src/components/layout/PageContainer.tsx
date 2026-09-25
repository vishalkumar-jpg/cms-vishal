import * as React from "react";
import { cn } from "@/lib/cn";

/** Standard responsive page padding + max width for admin list/detail views. */
export const PageContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={cn("mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8", className)}>{children}</div>
);

/** Stacks title + actions on narrow screens; row on sm+. */
export const PageHeader: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div
    className={cn(
      "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
      className,
    )}
  >
    {children}
  </div>
);

/** Horizontal scroll wrapper for data tables on mobile. */
export const ResponsiveTable: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
    <div className="min-w-[640px] rounded-lg border border-border">{children}</div>
  </div>
);
