"""Composes Fig. 2 from Symlit v0.1.0 screenshots of the composed recycling example
(build_recycling_composed.py): (a) the two domain metamodels with the PPR core types they reference,
(b) the instance project. Overlays: formulas defined on the sustainability types; values calculated in
the model, read from the project export (plastics-recycling-lab.symlit.json)."""
import json
from PIL import Image, ImageDraw, ImageFont

D = "screenshots/"                             # Symlit screenshots (1300x1250 px viewport, scale 3) of the four diagrams
S = 3                                         # device scale factor of the screenshots
X0, X1 = 414, 1206                            # diagram columns in CSS px (identical in all views)
BG = (248, 250, 252)
sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
mono = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
f_title, f_txt, f_mono = ImageFont.truetype(bold, 48), ImageFont.truetype(sans, 46), ImageFont.truetype(mono, 44)
f_sub = ImageFont.truetype(sans, 46)
DARK, GREY, LINE = (25, 25, 25), (100, 116, 139), (100, 116, 139)

# values from the export
exp = json.load(open("plastics-recycling-lab.symlit.json"))
vals = {}


def walk(o):
    if isinstance(o, dict):
        if "attributes" in o and "label" in o:
            for a in o["attributes"]:
                if a.get("value"):
                    vals[(o["label"], a["name"])] = (a["value"], a.get("unit", ""))
        for v in o.values():
            walk(v)
    elif isinstance(o, list):
        for v in o:
            walk(v)


walk(exp)
V = lambda el, at: " ".join(vals[(el, at)]).replace("CO2", "CO₂")


def crop(name, y0, y1):
    return Image.open(D + f"{name}_full.png").convert("RGB").crop((X0 * S, y0 * S, X1 * S, y1 * S))


LAB, DIAG, OV = 44, 645, 190                  # label height, diagram height, overlay band (CSS px)
W, H = (X1 - X0) * S, (DIAG + OV) * S


def overlay(img, top, anchors, title, rows):
    d = ImageDraw.Draw(img)
    bx0, by0, bx1, by1 = 15 * S, top * S, (X1 - X0 - 15) * S, (top + OV - 15) * S
    for ax, ay in anchors:
        for y in range(int(ay * S), int(by0), 22):
            d.line([(ax * S, y), (ax * S, min(y + 12, by0))], fill=LINE, width=5)
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=24, fill=(255, 255, 255), outline=LINE, width=5)
    x, y = bx0 + 40, by0 + 30
    d.text((x, y), title, fill=DARK, font=f_title); y += 78
    for row in rows:
        if row[0] == "note":
            d.text((x, y + 6), row[1], fill=GREY, font=f_txt); y += 64
        elif row[0] == "mono":
            d.text((x, y), row[1], fill=DARK, font=f_mono); y += 64
        else:
            _, label, via, value, strong = row
            fl = f_title if strong else f_txt
            d.text((x, y), label, fill=DARK, font=fl)
            if via:
                d.text((x + d.textlength(label + " ", font=fl), y), via, fill=GREY, font=f_txt)
            d.text((bx1 - 40 - d.textlength(value, font=fl), y), value, fill=DARK, font=fl)
            y += 68


# ---- (a) domain metamodels ----
a = Image.new("RGB", (W, H), BG)
da = ImageDraw.Draw(a)
res_y0, res_y1 = 569, 738
sus_y0, sus_y1 = 459, 847
da.text((15 * S, 10 * S), "Resilience metamodel  (references PPR core)", fill=GREY, font=f_sub)
a.paste(crop("res", res_y0, res_y1), (0, LAB * S))
off = LAB + (res_y1 - res_y0) + LAB
da.text((15 * S, (off - LAB + 10) * S), "Sustainability metamodel  (references PPR core)", fill=GREY, font=f_sub)
a.paste(crop("sus", sus_y0, sus_y1), (0, off * S))
sus_bottom = off + (sus_y1 - sus_y0)
assert sus_bottom <= DIAG, sus_bottom
to_a = lambda x, y: (x - X0, y - sus_y0 + off)
overlay(a, DIAG, [to_a(810, 822), to_a(1074, 822)], "Calculated attributes defined on the sustainability types",
        [("mono", "CO2 machine.co2PerHour = [power] *"),
         ("mono", "    sum([emissionFactor] of incoming \"supplies\")"),
         ("mono", "CO2 process.co2PerKg = sum([co2PerHour] of"),
         ("mono", "    incoming \"executes\") / [throughput]"),
         ("note", "power and throughput are inherited from the core types Machine and Process")])

# ---- (b) instance project ----
lab_y0 = 324
b = Image.new("RGB", (W, H), BG)
b.paste(crop("lab", lab_y0, lab_y0 + DIAG), (0, 0))
db = ImageDraw.Draw(b)
t = "Instance project  (references both domain metamodels)"
db.text((W - 15 * S - db.textlength(t, font=f_sub), 10 * S), t, fill=GREY, font=f_sub)
overlay(b, DIAG, [(810 - X0, 931 - lab_y0)], "Calculated on Shredding",
        [("val", "Shredder power", "(via executes)", V("Shredder", "power"), False),
         ("val", "Grid emission factor", "(via executes, supplies)", V("Grid electricity", "emissionFactor"), False),
         ("val", "Shredder emissions", "(calculated on Shredder)", V("Shredder", "co2PerHour"), False),
         ("val", "Throughput of Shredding", "", V("Shredding", "throughput"), False),
         ("val", "Emission intensity", "", V("Shredding", "co2PerKg").replace("/kg", "/kg flakes"), True)])

gap, band = 140, 140
fig = Image.new("RGB", (2 * W + gap, H + band), "white")
fig.paste(a, (0, band)); fig.paste(b, (W + gap, band))
d = ImageDraw.Draw(fig)
fb, fr = ImageFont.truetype(bold, 66), ImageFont.truetype(sans, 54)
d.text((20, 30), "(a) Domain metamodels", fill=DARK, font=fb)
d.text((W + gap + 20, 30), "(b) Model of the shredding step", fill=DARK, font=fb)
x, y = W - 30, 40
for label, col in reversed([("PPR core", (37, 99, 235)), ("Sustainability", (22, 163, 74)), ("Resilience", (220, 38, 38))]):
    x -= d.textlength(label, font=fr); d.text((x, y), label, fill=(60, 60, 60), font=fr); x -= 70
    d.rectangle([x, y + 8, x + 48, y + 56], fill=col); x -= 60
d.line([(W + gap // 2, band + 40), (W + gap // 2, fig.size[1] - 40)], fill=(200, 200, 200), width=4)
fig.save("figures/fig2_recycling.png")
fig.resize((fig.size[0] // 3, fig.size[1] // 3)).save(D + "fig2_small.png")
print(fig.size, round(fig.size[0] / fig.size[1], 3))
