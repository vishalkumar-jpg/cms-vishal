import { USE_STARTER_TEMPLATE_LABEL } from "./catalogLabels";

/** Read-only overflow actions available on Starter Template cards. */
export type StarterTemplateMenuAction = "preview" | "use" | "details" | "copyKey" | "copyId";

export type StarterTemplateMenuItem = {
  action: StarterTemplateMenuAction;
  label: string;
  disabled?: boolean;
};

/** Menu items for a starter card — no edit/delete/publish. */
export function starterTemplateMenuItems(canUse: boolean): StarterTemplateMenuItem[] {
  return [
    { action: "preview", label: "Preview" },
    { action: "details", label: "Details" },
    { action: "use", label: USE_STARTER_TEMPLATE_LABEL, disabled: !canUse },
    { action: "copyKey", label: "Copy template key" },
    { action: "copyId", label: "Copy template ID" },
  ];
}

export async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through
  }
  return false;
}
