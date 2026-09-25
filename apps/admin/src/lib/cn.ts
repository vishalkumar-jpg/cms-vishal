import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Local cn helper (mirrors @ob-cms/ui/cn) for admin-only primitives. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
