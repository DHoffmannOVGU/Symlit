/**
 * Units offered when defining number and derived attributes, grouped by the
 * quantity they measure. Attributes store the unit symbol as text, so a unit
 * outside this catalog still works; the editor marks it as custom.
 */

export interface UnitDefinition {
  symbol: string;
  name: string;
}

export interface QuantityGroup {
  quantity: string;
  units: UnitDefinition[];
}

export const UNIT_CATALOG: QuantityGroup[] = [
  { quantity: "Length", units: [
    { symbol: "µm", name: "micrometre" }, { symbol: "mm", name: "millimetre" }, { symbol: "cm", name: "centimetre" },
    { symbol: "m", name: "metre" }, { symbol: "km", name: "kilometre" }, { symbol: "in", name: "inch" },
    { symbol: "ft", name: "foot" }, { symbol: "mi", name: "mile" }, { symbol: "nmi", name: "nautical mile" },
  ] },
  { quantity: "Area", units: [
    { symbol: "mm²", name: "square millimetre" }, { symbol: "cm²", name: "square centimetre" },
    { symbol: "m²", name: "square metre" }, { symbol: "km²", name: "square kilometre" }, { symbol: "ha", name: "hectare" },
  ] },
  { quantity: "Volume", units: [
    { symbol: "mL", name: "millilitre" }, { symbol: "L", name: "litre" }, { symbol: "cm³", name: "cubic centimetre" },
    { symbol: "m³", name: "cubic metre" },
  ] },
  { quantity: "Mass", units: [
    { symbol: "mg", name: "milligram" }, { symbol: "g", name: "gram" }, { symbol: "kg", name: "kilogram" },
    { symbol: "t", name: "tonne" }, { symbol: "lb", name: "pound" },
  ] },
  { quantity: "Time", units: [
    { symbol: "µs", name: "microsecond" }, { symbol: "ms", name: "millisecond" }, { symbol: "s", name: "second" },
    { symbol: "min", name: "minute" }, { symbol: "h", name: "hour" }, { symbol: "d", name: "day" },
    { symbol: "a", name: "year" },
  ] },
  { quantity: "Speed", units: [
    { symbol: "m/s", name: "metre per second" }, { symbol: "km/h", name: "kilometre per hour" },
    { symbol: "kn", name: "knot" }, { symbol: "mph", name: "mile per hour" },
  ] },
  { quantity: "Acceleration", units: [{ symbol: "m/s²", name: "metre per second squared" }, { symbol: "g₀", name: "standard gravity" }] },
  { quantity: "Frequency", units: [
    { symbol: "Hz", name: "hertz" }, { symbol: "kHz", name: "kilohertz" }, { symbol: "MHz", name: "megahertz" },
    { symbol: "GHz", name: "gigahertz" }, { symbol: "rpm", name: "revolutions per minute" },
  ] },
  { quantity: "Force", units: [{ symbol: "N", name: "newton" }, { symbol: "kN", name: "kilonewton" }] },
  { quantity: "Torque", units: [{ symbol: "N·m", name: "newton metre" }] },
  { quantity: "Pressure", units: [
    { symbol: "Pa", name: "pascal" }, { symbol: "kPa", name: "kilopascal" }, { symbol: "MPa", name: "megapascal" },
    { symbol: "bar", name: "bar" }, { symbol: "psi", name: "pound per square inch" },
  ] },
  { quantity: "Energy", units: [
    { symbol: "J", name: "joule" }, { symbol: "kJ", name: "kilojoule" }, { symbol: "MJ", name: "megajoule" },
    { symbol: "Wh", name: "watt-hour" }, { symbol: "kWh", name: "kilowatt-hour" }, { symbol: "MWh", name: "megawatt-hour" },
  ] },
  { quantity: "Power", units: [
    { symbol: "mW", name: "milliwatt" }, { symbol: "W", name: "watt" }, { symbol: "kW", name: "kilowatt" },
    { symbol: "MW", name: "megawatt" },
  ] },
  { quantity: "Electric", units: [
    { symbol: "V", name: "volt" }, { symbol: "mV", name: "millivolt" }, { symbol: "kV", name: "kilovolt" },
    { symbol: "A", name: "ampere" }, { symbol: "mA", name: "milliampere" }, { symbol: "Ω", name: "ohm" },
    { symbol: "Ah", name: "ampere-hour" }, { symbol: "mAh", name: "milliampere-hour" }, { symbol: "F", name: "farad" },
  ] },
  { quantity: "Temperature", units: [{ symbol: "°C", name: "degree Celsius" }, { symbol: "K", name: "kelvin" }, { symbol: "°F", name: "degree Fahrenheit" }] },
  { quantity: "Angle", units: [{ symbol: "°", name: "degree" }, { symbol: "rad", name: "radian" }] },
  { quantity: "Data", units: [
    { symbol: "bit", name: "bit" }, { symbol: "B", name: "byte" }, { symbol: "kB", name: "kilobyte" },
    { symbol: "MB", name: "megabyte" }, { symbol: "GB", name: "gigabyte" }, { symbol: "TB", name: "terabyte" },
  ] },
  { quantity: "Data rate", units: [
    { symbol: "bit/s", name: "bit per second" }, { symbol: "kbit/s", name: "kilobit per second" },
    { symbol: "Mbit/s", name: "megabit per second" }, { symbol: "Gbit/s", name: "gigabit per second" },
  ] },
  { quantity: "Ratio", units: [{ symbol: "%", name: "percent" }, { symbol: "ppm", name: "parts per million" }, { symbol: "dB", name: "decibel" }] },
  { quantity: "Count", units: [{ symbol: "pcs", name: "pieces" }] },
  { quantity: "Currency", units: [{ symbol: "€", name: "euro" }, { symbol: "$", name: "US dollar" }, { symbol: "£", name: "pound sterling" }] },
];

const bySymbol = new Map<string, { unit: UnitDefinition; quantity: string }>();
for (const group of UNIT_CATALOG) {
  for (const unit of group.units) bySymbol.set(unit.symbol, { unit, quantity: group.quantity });
}

/** The catalog entry for a stored unit symbol, or undefined for a custom unit. */
export function findUnit(symbol: string): { unit: UnitDefinition; quantity: string } | undefined {
  return bySymbol.get(symbol.trim());
}

/**
 * Catalog groups filtered by a search: matches the symbol, the unit's name
 * or the quantity ("energy" lists every energy unit). Empty search: everything.
 */
export function searchUnits(query: string): QuantityGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return UNIT_CATALOG;
  return UNIT_CATALOG.map((group) => {
    if (group.quantity.toLowerCase().includes(q)) return group;
    const units = group.units.filter(
      (unit) => unit.symbol.toLowerCase().includes(q) || unit.name.toLowerCase().includes(q),
    );
    return { quantity: group.quantity, units };
  }).filter((group) => group.units.length > 0);
}
