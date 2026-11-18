/**
 * How attribute values are stored and shown. Every value is stored as a
 * string; a multiselect attribute stores its chosen options as a JSON array
 * of strings (`["PLA","PETG"]`), so that an option may contain a comma.
 */

/** The options chosen in a multiselect value. Tolerates a plain or comma-separated string. */
export function parseMultiselectValue(value: unknown): string[] {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return Array.from(new Set(parsed.map((item) => String(item).trim()).filter(Boolean)));
      }
    } catch {
      // Not JSON after all: read it as text below.
    }
  }
  return Array.from(new Set(raw.split(",").map((item) => item.trim()).filter(Boolean)));
}

/**
 * Stores chosen options, in the order of `options` when it is given (so the
 * value does not depend on the order they were ticked), dropping any that
 * are not among them.
 */
export function formatMultiselectValue(selected: string[], options?: string[]): string {
  const chosen = new Set(selected.map((item) => item.trim()).filter(Boolean));
  const ordered = options ? options.filter((option) => chosen.has(option)) : Array.from(chosen);
  return ordered.length ? JSON.stringify(ordered) : "";
}

/** A multiselect value with only the options that still exist. */
export const keepExistingOptions = (value: unknown, options: string[]) =>
  formatMultiselectValue(parseMultiselectValue(value), options);

/** An attribute's value as people read it: Yes/No, chosen options separated by commas. */
export function displayAttributeValue(attribute: { type?: string; value?: unknown }): string {
  const raw = attribute.value == null ? "" : String(attribute.value);
  if (attribute.type === "multiselect") return parseMultiselectValue(raw).join(", ");
  if (attribute.type === "boolean") return raw === "true" ? "Yes" : raw === "false" ? "No" : raw;
  return raw;
}
