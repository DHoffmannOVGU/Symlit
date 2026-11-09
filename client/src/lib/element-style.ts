/**
 * How an element looks, and how elements in an instance model get their look
 * from their type in a metamodel.
 *
 * Every style setting is stored flat on the element's data, next to its label.
 * A type (an element in a metamodel) carries its own style. An instance
 * element either *matches its type* (`inheritStyle: true`): it shows the
 * type's style, copied onto it and refreshed whenever the type changes; or it
 * has its own style (`inheritStyle: false`), and changes to the type leave it
 * alone. Matching is all or nothing: every setting below comes from the type.
 */

export const borderStyles = ["solid", "dashed", "dotted"] as const;
export type BorderStyle = (typeof borderStyles)[number];

export const borderWidths = [1, 2, 3, 4] as const;
export type BorderWidth = (typeof borderWidths)[number];

export const elementShapes = ["square", "rounded", "pill"] as const;
export type ElementShape = (typeof elementShapes)[number];

export const elementFills = ["plain", "tint", "solid"] as const;
export type ElementFill = (typeof elementFills)[number];

export const descriptionModes = ["show", "hide"] as const;
/** Per element; when unset the canvas-wide "Show node descriptions" decides. */
export type DescriptionMode = (typeof descriptionModes)[number];

export interface ElementStyle {
  icon?: string;
  /** Accent colour (#rrggbb). Empty or missing means the kind's default colour. */
  color?: string;
  borderWidth?: BorderWidth;
  borderStyle?: BorderStyle;
  shape?: ElementShape;
  fill?: ElementFill;
  /** Show the type name in the card's header. Default: shown. */
  showTypeLabel?: boolean;
  /** Show or hide the description on the card regardless of the canvas setting. */
  descriptionOnCard?: DescriptionMode;
}

/** Every key that belongs to an element's style, in display order. */
export const ELEMENT_STYLE_KEYS = [
  "icon",
  "color",
  "borderWidth",
  "borderStyle",
  "shape",
  "fill",
  "showTypeLabel",
  "descriptionOnCard",
] as const satisfies ReadonlyArray<keyof ElementStyle>;

/** What an element looks like when a setting is not given. */
export const DEFAULT_ELEMENT_STYLE: Omit<Required<ElementStyle>, "icon" | "color" | "descriptionOnCard"> = {
  borderWidth: 2,
  borderStyle: "solid",
  shape: "rounded",
  fill: "plain",
  showTypeLabel: true,
};

const isOneOf = <T extends string | number>(values: readonly T[], value: unknown): value is T =>
  (values as readonly unknown[]).includes(value);

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * The style settings stored on an element's data. Unknown or malformed values
 * are dropped, so whatever an old diagram or a hand-edited export holds, the
 * result is safe to render and to copy onto other elements.
 */
export function pickElementStyle(source: object | undefined | null): ElementStyle {
  if (!source) return {};
  const data = source as Record<string, unknown>;
  const style: ElementStyle = {};
  if (typeof data.icon === "string" && data.icon.trim()) style.icon = data.icon;
  if (typeof data.color === "string" && HEX_COLOR.test(data.color)) style.color = data.color;
  if (isOneOf(borderWidths, data.borderWidth)) style.borderWidth = data.borderWidth;
  if (isOneOf(borderStyles, data.borderStyle)) style.borderStyle = data.borderStyle;
  if (isOneOf(elementShapes, data.shape)) style.shape = data.shape;
  if (isOneOf(elementFills, data.fill)) style.fill = data.fill;
  if (typeof data.showTypeLabel === "boolean") style.showTypeLabel = data.showTypeLabel;
  if (isOneOf(descriptionModes, data.descriptionOnCard)) style.descriptionOnCard = data.descriptionOnCard;
  return style;
}

/**
 * The style a type hands down to its elements: its own settings, with the
 * icon and colour of its kind (Object, Behavior, ...) where it has none.
 */
export function typeStyle(
  typeData: object | undefined | null,
  kindDefaults: { icon: string; color: string },
): ElementStyle {
  const own = pickElementStyle(typeData);
  return { ...own, icon: own.icon ?? kindDefaults.icon, color: own.color ?? kindDefaults.color };
}

/**
 * Whether an instance element shows its type's style. Elements saved before
 * `inheritStyle` existed match their type unless they had their own icon or colour.
 */
export function matchesTypeStyle(data: Record<string, unknown> | undefined | null): boolean {
  if (!data?.typeId) return false;
  if (data.inheritStyle === true) return true;
  if (data.inheritStyle === false) return false;
  return !data.icon && !data.color;
}

/** Same settings, ignoring keys that are not set. */
export function sameElementStyle(a: ElementStyle, b: ElementStyle): boolean {
  return ELEMENT_STYLE_KEYS.every((key) => a[key] === b[key]);
}

/** `data` without any style settings. */
export function withoutElementStyle<T extends Record<string, unknown>>(data: T): T {
  const next: Record<string, unknown> = { ...data };
  for (const key of ELEMENT_STYLE_KEYS) delete next[key];
  return next as T;
}

/** `data` with exactly the given style: settings not in `style` are removed. */
export function withElementStyle<T extends Record<string, unknown>>(data: T, style: ElementStyle): T {
  return { ...withoutElementStyle(data), ...style };
}

/**
 * An instance element showing its type's style: the type's settings replace
 * the element's own, and the element is marked as matching its type.
 */
export function applyTypeStyle<T extends Record<string, unknown>>(data: T, style: ElementStyle): T {
  return { ...withElementStyle(data, style), inheritStyle: true };
}

/**
 * Brings an instance element up to date with its type. Returns the same
 * object when nothing changes, so callers can skip needless re-renders.
 */
export function syncWithTypeStyle<T extends Record<string, unknown>>(
  data: T,
  style: ElementStyle | undefined,
): T {
  if (!style || !matchesTypeStyle(data)) return data;
  if (data.inheritStyle === true && sameElementStyle(pickElementStyle(data), style)) return data;
  return applyTypeStyle(data, style);
}

/** Whether the card shows the description: the element's own choice, else the canvas setting. */
export function showsDescription(style: ElementStyle, canvasShowsDescriptions: boolean): boolean {
  if (style.descriptionOnCard === "show") return true;
  if (style.descriptionOnCard === "hide") return false;
  return canvasShowsDescriptions;
}

/** CSS for an element card with the given style. */
export function elementCardAppearance(style: ElementStyle, accentColor: string) {
  const borderWidth = style.borderWidth ?? DEFAULT_ELEMENT_STYLE.borderWidth;
  const borderStyle = style.borderStyle ?? DEFAULT_ELEMENT_STYLE.borderStyle;
  const shape = style.shape ?? DEFAULT_ELEMENT_STYLE.shape;
  const fill = style.fill ?? DEFAULT_ELEMENT_STYLE.fill;
  const solid = fill === "solid";
  return {
    borderWidth,
    borderStyle,
    borderRadius: shape === "square" ? 4 : shape === "pill" ? 9999 : 12,
    backgroundColor: solid ? accentColor : fill === "tint" ? `${accentColor}1A` : undefined,
    /** Text on a solid fill is white; everything else uses the theme colours. */
    onSolid: solid,
    showTypeLabel: style.showTypeLabel ?? DEFAULT_ELEMENT_STYLE.showTypeLabel,
  };
}
