
export const nodeColors = [
  { label: "Default", value: "" },
  { label: "Dark", value: "#1f2937" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Purple", value: "#a855f7" },
  { label: "Emerald", value: "#10b981" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Amber", value: "#f59e0b" },
];

export const attributeTypes = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "derived", label: "Derived Formula" },
  { value: "boolean", label: "Yes/No" },
  { value: "date", label: "Date" },
  { value: "list", label: "List" },
];

export const sanitizeAttributeOptions = (options?: string[]) =>
  Array.from(
    new Set((options ?? []).map((option) => option.trim()).filter(Boolean)),
  );
