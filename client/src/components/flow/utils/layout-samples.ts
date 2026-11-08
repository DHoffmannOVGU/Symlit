import type { Edge, Node } from "@xyflow/react";

/**
 * Sample diagrams for judging Auto Layout quality (see autolayout-quality.test.ts).
 * Elements are 300×200 like rendered elements; handles are the side ids.
 */
type Side = "top" | "right" | "bottom" | "left";
const node = (id: string, x = 0, y = 0): Node => ({ id, position: { x, y }, data: { label: id }, measured: { width: 300, height: 200 } });
const edge = (source: string, target: string, sourceHandle: Side, targetHandle: Side): Edge => ({
  id: `${source}-${sourceHandle}->${target}-${targetHandle}`,
  source,
  target,
  sourceHandle,
  targetHandle,
});
const down = (s: string, t: string) => edge(s, t, "bottom", "top");
const side = (s: string, t: string) => edge(s, t, "right", "left");

function droneSystem() {
  const ids = ["drone", "airframe", "propulsion", "avionics", "payload", "arm", "motor", "esc", "propeller", "fc", "gps", "camera", "gimbal"];
  const nodes = ids.map((id, i) => node(id, (i % 4) * 350, Math.floor(i / 4) * 260));
  const edges = [
    down("drone", "airframe"), down("drone", "propulsion"), down("drone", "avionics"), down("drone", "payload"),
    down("airframe", "arm"), down("propulsion", "motor"), down("propulsion", "esc"), down("propulsion", "propeller"),
    down("avionics", "fc"), down("avionics", "gps"), down("payload", "camera"), down("payload", "gimbal"),
    side("esc", "motor"), side("fc", "esc"), side("gimbal", "camera"),
  ];
  return { name: "drone system (tree + side links)", nodes, edges };
}

function sidewaysChain() {
  const ids = ["order", "check", "pick", "pack", "ship", "deliver"];
  const nodes = ids.map((id, i) => node(id, (i % 3) * 400, Math.floor(i / 3) * 300));
  const edges = ids.slice(1).map((id, i) => side(ids[i], id));
  edges.push(down("check", "pick"));
  return { name: "process chain (side to side)", nodes, edges };
}

function randomMix(seed = 7, count = 15, edgeCount = 22) {
  let state = seed;
  const random = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const sides: Side[] = ["top", "right", "bottom", "left"];
  const nodes = Array.from({ length: count }, (_, i) => node(`n${i}`, Math.floor(random() * 1500), Math.floor(random() * 1000)));
  const edges: Edge[] = [];
  const seen = new Set<string>();
  while (edges.length < edgeCount) {
    const a = Math.floor(random() * count);
    const b = Math.floor(random() * count);
    if (a === b || seen.has(`${a}-${b}`)) continue;
    seen.add(`${a}-${b}`);
    edges.push(edge(`n${a}`, `n${b}`, sides[Math.floor(random() * 4)], sides[Math.floor(random() * 4)]));
  }
  return { name: "random mix (all handle sides)", nodes, edges };
}

function deliveryDrone() {
  const nodes = [node("courier", 80, 80), node("pack", 480, 80), node("delivery", 80, 360)];
  const edges = [side("courier", "pack"), down("courier", "delivery")];
  return { name: "tutorial instance", nodes, edges };
}

export const LAYOUT_SAMPLES = [droneSystem(), sidewaysChain(), randomMix(), deliveryDrone()];
