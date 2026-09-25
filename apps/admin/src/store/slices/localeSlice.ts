import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Locale is Redux (UI-only state), per _CONVENTIONS.md. */
interface LocaleState {
  locale: string;
}

const initialState: LocaleState = { locale: "en" };

const localeSlice = createSlice({
  name: "locale",
  initialState,
  reducers: {
    setLocale(state, action: PayloadAction<string>) {
      state.locale = action.payload;
    },
  },
});

export const { setLocale } = localeSlice.actions;
export default localeSlice.reducer;
