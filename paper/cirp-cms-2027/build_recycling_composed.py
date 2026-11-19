"""Builds the author-built abstraction of the plastics recycling laboratory (Fig. 2) in a local
Symlit v0.1.0 (npm run dev, http://127.0.0.1:5000) with the composition of Fig. 1:

  PPR core (metamodel)            Material, Process, Machine and their relationships
  Resilience (metamodel)          references the core; Disruption affects Machine, Mitigation mitigates Disruption
  Sustainability (metamodel)      references the core; Power supply supplies Machine; CO2 machine and
                                  CO2 process specialise Machine and Process and own the calculated attributes
  Plastics recycling lab (model)  references Resilience and Sustainability; the core is resolved through them

Afterwards the model is validated on the server. Diagram positions are on a grid so that all lines are straight."""
import json, urllib.request, uuid

B = "http://127.0.0.1:5000"


def call(method, path, body=None):
    req = urllib.request.Request(B + path, method=method,
                                 data=(json.dumps(body).encode() if body is not None else None),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:800]


nid = lambda: "node_" + str(uuid.uuid4())
eid = lambda: "edge_" + str(uuid.uuid4())
KIND = {"partdef": "Object", "actiondef": "Behavior", "agentdef": "Performer", "eventdef": "Event"}
PPR, SUS, RES = "#2563eb", "#16a34a", "#dc2626"
COL, ROW = [0, 264, 528], [0, 219, 438]


def attr(name, unit="", formula=None):
    a = dict(id="attr-" + name, name=name, type=("related" if formula else "number"), unit=unit, value="")
    if formula:
        a["formula"] = formula
    return a


def tnode(kind, label, c, r, attrs, color, desc):
    return dict(id=nid(), type=kind, position=dict(x=COL[c], y=ROW[r]),
                data=dict(label=label, type=KIND[kind], color=color, description=desc, attributes=list(attrs)))


def edge(s, t, edge_type, label, sh, th):
    return dict(id=eid(), source=s["id"], target=t["id"], edgeType=edge_type, sourceHandle=sh, targetHandle=th,
                data=dict(label=label, edgeType=edge_type))


def project(name, desc, ptype, refs=()):
    s, p = call("POST", "/api/projects", dict(name=name, description=desc, projectType=ptype, referencedMetamodels=list(refs)))
    assert s == 201, (s, p)
    s, v = call("POST", f"/api/projects/{p['id']}/views", dict(name="Main", description=""))
    assert s == 201, (s, v)
    return p, v["id"]


def sync(view, nodes, edges):
    s, r = call("POST", f"/api/views/{view}/sync", dict(nodes=nodes, edges=edges))
    assert s == 200, (s, r)


def with_foreign(view, foreign):
    """Places referenced core types in a domain-metamodel diagram; they stay owned by the core project."""
    for node, c, r in foreign:
        s, res = call("POST", f"/api/views/{view}/nodes/{node['id']}/insert", dict(position=dict(x=COL[c], y=ROW[r])))
        assert s in (200, 201), (s, res)
    s, f = call("GET", f"/api/views/{view}/flow")
    return [dict(id=n["id"], type=n["type"], position=n["position"], data=n["data"], parentId=n.get("parentId")) for n in f["nodes"]]


# ---------- PPR core ----------
core, cv = project("PPR core", "Products, processes and resources of the recycling laboratory.", "metamodel")
material = tnode("partdef", "Material", 0, 1, [], PPR, "Input, intermediate or recycled material.")
process = tnode("actiondef", "Process", 1, 1, [attr("throughput", "kg/h")], PPR, "Processing step.")
machine = tnode("agentdef", "Machine", 1, 0, [attr("power", "kW")], PPR, "Machine that executes a process.")
sync(cv, [material, process, machine], [
    edge(material, process, "association", "input of", "right", "left"),
    edge(process, material, "association", "produces", "bottom", "bottom"),
    edge(machine, process, "association", "executes", "bottom", "top"),
])

# ---------- Resilience (references the core) ----------
res, rv = project("Resilience", "Disruptions of machines and their mitigations.", "metamodel", [core["id"]])
disruption = tnode("eventdef", "Disruption", 1, 0, [attr("downtime", "h")], RES, "Event that can stop a machine.")
mitigation = tnode("actiondef", "Mitigation", 0, 0, [attr("downtime", "h")], RES, "Measure that limits the effect of a disruption.")
sync(rv, with_foreign(rv, [(machine, 2, 0)]) + [disruption, mitigation], [
    edge(mitigation, disruption, "dependency", "mitigates", "right", "left"),
    edge(disruption, machine, "dependency", "affects", "right", "left"),
])

# ---------- Sustainability (references the core) ----------
sus, sv = project("Sustainability", "Energy supply and emissions of machines and processes.", "metamodel", [core["id"]])
supply = tnode("partdef", "Power supply", 0, 0, [attr("emissionFactor", "kg CO2/kWh")], SUS, "Energy carrier that supplies machines.")
er_machine = tnode("agentdef", "CO2 machine", 1, 1,
                   [attr("co2PerHour", "kg CO2/h", '[attr:attr-power] * sum([attr:attr-emissionFactor] of incoming "supplies")')],
                   SUS, "Machine with electricity-related emissions.")
er_process = tnode("actiondef", "CO2 process", 2, 1,
                   [attr("co2PerKg", "kg CO2/kg", 'sum([attr:attr-co2PerHour] of incoming "executes") / [attr:attr-throughput]')],
                   SUS, "Process with emissions per kilogram of output.")
sync(sv, with_foreign(sv, [(machine, 1, 0), (process, 2, 0)]) + [supply, er_machine, er_process], [
    edge(supply, machine, "association", "supplies", "right", "left"),
    edge(er_machine, machine, "generalization", "", "top", "bottom"),
    edge(er_process, process, "generalization", "", "top", "bottom"),
])


# ---------- Instance project (references both domain metamodels) ----------
def tid(owner, node):
    return f"mm:{owner['id']}:{node['id']}"


def inst(label, owner, tn, c, r, values=None, supertypes=()):
    """Element typed by tn; attributes of supertypes are pulled in as in the editor's Inherit Attributes dialog."""
    values = values or {}
    attrs = []
    for o, t in [(owner, tn), *supertypes]:
        attrs += [dict(a, value=values.get(a["name"], ""), inheritedFrom=dict(nodeId=tid(o, t), attrId=a["id"]))
                  for a in t["data"]["attributes"]]
    return dict(id=nid(), type="part", position=dict(x=COL[c], y=ROW[r]),
                data=dict(label=label, type=tn["data"]["label"], typeId=tid(owner, tn),
                          color=tn["data"]["color"], attributes=attrs, inheritStyle=True))


lab, lv = project("Plastics recycling lab (abstracted)", "Shredding step with its resilience and sustainability context.",
                  "instance", [res["id"], sus["id"]])
mitig_i = inst("Replace worn blades", res, mitigation, 0, 0, {"downtime": "1"})
wear = inst("Blade wear", res, disruption, 0, 1, {"downtime": "8"})
shredder = inst("Shredder", sus, er_machine, 1, 1, {"power": "7.5"}, [(core, machine)])
grid = inst("Grid electricity", sus, supply, 2, 1, {"emissionFactor": "0.38"})
waste = inst("PP waste", core, material, 0, 2)
shredding = inst("Shredding", sus, er_process, 1, 2, {"throughput": "30"}, [(core, process)])
flakes = inst("PP flakes", core, material, 2, 2)
sync(lv, [mitig_i, wear, shredder, grid, waste, shredding, flakes], [
    edge(mitig_i, wear, "dependency", "mitigates", "bottom", "top"),
    edge(wear, shredder, "dependency", "affects", "right", "left"),        # resilience type -> core type (via subtype)
    edge(grid, shredder, "association", "supplies", "left", "right"),     # sustainability -> core type (via subtype)
    edge(shredder, shredding, "association", "executes", "bottom", "top"),  # core relationship inherited by both subtypes
    edge(waste, shredding, "association", "input of", "right", "left"),
    edge(shredding, flakes, "association", "produces", "right", "left"),
])
s, r = call("POST", f"/api/views/{lv}/validate")
print("validate", s, json.dumps(r))
json.dump(dict(core=core["id"], cv=cv, res=res["id"], rv=rv, sus=sus["id"], sv=sv, lab=lab["id"], lv=lv),
          open("composed_ids.json", "w"))
