import { type ReactNode } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/store/store";
import { QueryProvider } from "./QueryProvider";

/** Composes the app's providers: Redux (theme/locale) + TanStack Query. */
export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ReduxProvider store={store}>
    <QueryProvider>{children}</QueryProvider>
  </ReduxProvider>
);
