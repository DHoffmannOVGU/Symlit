import {
  Activity,
  Aperture,
  Atom,
  BadgeCheck,
  Battery,
  Bell,
  Box,
  Briefcase,
  Calendar,
  Camera,
  Cloud,
  Code2,
  Compass,
  Cpu,
  Crown,
  Database,
  Diamond,
  Eye,
  Factory,
  Flame,
  Flower2,
  Gem,
  Globe,
  Heart,
  KeyRound,
  Leaf,
  LifeBuoy,
  Lock,
  Map as MapIcon,
  Moon,
  Mountain,
  Network,
  Package,
  Pencil,
  Rocket,
  Ruler,
  Scan,
  Server,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Star,
  Sun,
  Target,
  Timer,
  TreePine,
  Trophy,
  Wallet,
  Wrench,
  Zap,
  ArrowDownRight,
  Bot,
  Boxes,
  ClipboardCheck,
  FileCheck2,
  GitBranch,
  Globe2,
  Link2,
  Radio,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/*
 * Icons elements can show, by the name stored in their data (`icon`/`iconName`).
 * Only these are bundled: importing all of lucide-react to look names up
 * added ~750 kB to the editor. Add a name here before using it anywhere.
 */


export interface NodeIconEntry {
  value: string;
  icon: LucideIcon;
}

export const quickNodeIcons: NodeIconEntry[] = [
  { value: "Box", icon: Box },
  { value: "Cpu", icon: Cpu },
  { value: "Settings", icon: Settings },
  { value: "Database", icon: Database },
  { value: "Activity", icon: Activity },
  { value: "Zap", icon: Zap },
  { value: "Shield", icon: Shield },
  { value: "BadgeCheck", icon: BadgeCheck },
];

export const extendedNodeIcons: NodeIconEntry[] = [
  { value: "Share2", icon: Share2 },
  { value: "Aperture", icon: Aperture },
  { value: "Atom", icon: Atom },
  { value: "Battery", icon: Battery },
  { value: "Bell", icon: Bell },
  { value: "Briefcase", icon: Briefcase },
  { value: "Calendar", icon: Calendar },
  { value: "Camera", icon: Camera },
  { value: "Cloud", icon: Cloud },
  { value: "Code2", icon: Code2 },
  { value: "Compass", icon: Compass },
  { value: "Crown", icon: Crown },
  { value: "Diamond", icon: Diamond },
  { value: "Eye", icon: Eye },
  { value: "Factory", icon: Factory },
  { value: "Flame", icon: Flame },
  { value: "Flower2", icon: Flower2 },
  { value: "Gem", icon: Gem },
  { value: "Globe", icon: Globe },
  { value: "Heart", icon: Heart },
  { value: "KeyRound", icon: KeyRound },
  { value: "Leaf", icon: Leaf },
  { value: "LifeBuoy", icon: LifeBuoy },
  { value: "Lock", icon: Lock },
  { value: "Map", icon: MapIcon },
  { value: "Moon", icon: Moon },
  { value: "Mountain", icon: Mountain },
  { value: "Network", icon: Network },
  { value: "Package", icon: Package },
  { value: "Pencil", icon: Pencil },
  { value: "Rocket", icon: Rocket },
  { value: "Ruler", icon: Ruler },
  { value: "Scan", icon: Scan },
  { value: "Server", icon: Server },
  { value: "Sparkles", icon: Sparkles },
  { value: "Star", icon: Star },
  { value: "Sun", icon: Sun },
  { value: "Target", icon: Target },
  { value: "Timer", icon: Timer },
  { value: "TreePine", icon: TreePine },
  { value: "Trophy", icon: Trophy },
  { value: "Wallet", icon: Wallet },
  { value: "Wrench", icon: Wrench },
];

/** Icons used by built-in element types, templates, the tutorial and relationship toolbars. */
const builtInIcons: NodeIconEntry[] = [
  { value: "ArrowDownRight", icon: ArrowDownRight },
  { value: "Bot", icon: Bot },
  { value: "Boxes", icon: Boxes },
  { value: "ClipboardCheck", icon: ClipboardCheck },
  { value: "FileCheck2", icon: FileCheck2 },
  { value: "GitBranch", icon: GitBranch },
  { value: "Globe2", icon: Globe2 },
  { value: "Link2", icon: Link2 },
  { value: "Radio", icon: Radio },
  { value: "UserRound", icon: UserRound },
];

const iconsByName = new Map<string, LucideIcon>(
  [...quickNodeIcons, ...extendedNodeIcons, ...builtInIcons].map((entry) => [entry.value, entry.icon]),
);

/** Names that `getNodeIcon` knows. */
export const NODE_ICON_NAMES: readonly string[] = Array.from(iconsByName.keys());

/** The icon stored under `name`, or the default box for unknown or missing names. */
export function getNodeIcon(name: string | null | undefined): LucideIcon {
  return (name && iconsByName.get(name)) || Box;
}
