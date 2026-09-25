import type { AxiosError } from "axios";

export const connectorErrMessage = (e: unknown, fallback: string): string => {
  const ax = e as AxiosError<{ message?: string }>;
  return ax?.response?.data?.message ?? fallback;
};
