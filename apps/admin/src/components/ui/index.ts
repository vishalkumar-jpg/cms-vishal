/**
 * Admin design-system barrel. Re-exports the shared @ob-cms/ui primitives plus
 * the admin-local Radix primitives (dialog, dropdown, tabs, select, etc.).
 * Import everything UI from "@/components/ui".
 */
export { cn } from "@/lib/cn";
export {
  Button,
  buttonVariants,
  type ButtonProps,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Input,
} from "@ob-cms/ui";

export * from "./dialog";
export * from "./dropdown-menu";
export * from "./tabs";
export * from "./select";
export * from "./switch";
export * from "./label";
export * from "./badge";
export * from "./tooltip";
export * from "./textarea";
export { Toaster, toast } from "./toaster";
export * from "./confirm-provider";
