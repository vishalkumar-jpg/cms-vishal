import * as React from "react";
import {
  FormRenderContext,
  type FormRenderContextValue,
  type FormDef,
} from "@ob-cms/blocks";
import { getFormRequest } from "@/views/forms/api/forms.api";

/**
 * Builder-side form runtime (preview mode). Provides the `FormRenderContext`
 * that Form blocks on the canvas read so the chosen form's fields render in the
 * editor — WYSIWYG with the published site. `getForm` fetches via the admin
 * axios (`GET /forms/:id`, site-scoped by the X-Site-Id header); `submit` is a
 * no-op that resolves `ok` (the builder never posts real submissions).
 */
export const PreviewFormProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const value = React.useMemo<FormRenderContextValue>(
    () => ({
      mode: "preview",
      getForm: async (formId) => {
        try {
          const form = await getFormRequest(formId);
          return {
            id: form.id,
            name: form.name,
            fields: form.fields as FormDef["fields"],
            settings: form.settings,
          };
        } catch {
          return null;
        }
      },
      submit: async () => ({ ok: true }),
    }),
    [],
  );

  return (
    <FormRenderContext.Provider value={value}>
      {children}
    </FormRenderContext.Provider>
  );
};
