import Axios from "axios";

/** Prefer Nest/API `message` (string or string[]) when present; else fallback. */
export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (!Axios.isAxiosError(err)) {
    return err instanceof Error && err.message ? err.message : fallback;
  }
  const message = err.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message) && message.length > 0) {
    const parts = message
      .filter((part): part is string => typeof part === "string")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length > 0) return parts.join("; ");
  }
  return fallback;
};
