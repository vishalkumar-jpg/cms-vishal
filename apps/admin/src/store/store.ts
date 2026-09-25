import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import themeReducer from "./slices/themeSlice";
import localeReducer from "./slices/localeSlice";

/** Redux holds ONLY theme/locale (UI state). Server state = TanStack Query;
 *  session = Zustand authStore. (per _CONVENTIONS.md) */
export const store = configureStore({
  reducer: {
    theme: themeReducer,
    locale: localeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
