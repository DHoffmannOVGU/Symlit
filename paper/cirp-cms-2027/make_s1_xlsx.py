"""Writes S1_Requirements_Catalogue_Symlit.xlsx (sheets: About, Reporting groups, Atomic requirements, Publications)
from requirements-mapping.csv and literature.py; same content as requirements-catalogue.md."""
import csv
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from make_catalogue import GROUPS, order, num, surnames, ranges  # noqa: reuses the catalogue's numbering
from literature import LIT, CLUSTERS

rows = list(csv.DictReader(open("requirements-mapping.csv", encoding="utf8")))
F = "Arial"
HEAD = PatternFill("solid", fgColor="DCE6F1")
thin = Border(bottom=Side(style="thin", color="A6A6A6"))
wb = Workbook()


def sheet(ws, header, data, widths):
    ws.append(header)
    for c in ws[1]:
        c.font = Font(name=F, bold=True, size=10); c.fill = HEAD
        c.alignment = Alignment(vertical="top", wrap_text=True)
    for r in data:
        ws.append(r)
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.font = Font(name=F, size=10); c.alignment = Alignment(vertical="top", wrap_text=True); c.border = thin
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions


# --- About ---
ab = wb.active; ab.title = "About"
text = [
    ("Supplementary Material S1 – Requirements Catalogue for Symlit", True),
    ("D. Hoffmann, C. Binder, A. Lüder: Symlit: Composing Domain Metamodels for Resilience and Sustainability in "
     "Production Systems. CIRP CMS 2027.", False),
    ("", False),
    ("Derivation: 76 publications from six areas (clusters A–F) were read in full. 307 distinct statements on needs and "
     "shortcomings were extracted with page references, coded deductively and inductively, and consolidated into 28 "
     "atomic requirements (one need each), each supported by at least two independent publications. A statement could "
     "support more than one atomic requirement (193 statements did), which yields 568 statement–requirement assignments. "
     "The statement counts per requirement count these assignments. Coding was performed by one coder and reviewed by "
     "the authors.", False),
    ("Reporting groups R1 to R8 correspond to Table 1 of the paper, and the coverage column corresponds to Table 2. The "
     "supporting publications establish why a requirement matters, not that Symlit meets it.", False),
    ("Sources in 'Atomic requirements' are numbers in 'Publications'.", False),
    ("", False),
]
for t, b in text:
    ab.append([t]); c = ab.cell(ab.max_row, 1); c.font = Font(name=F, bold=b, size=12 if b else 10)
    c.alignment = Alignment(wrap_text=True, vertical="top")
ab.append(["Check", "Value"])
for c in ab[ab.max_row]:
    c.font = Font(name=F, bold=True, size=10); c.fill = HEAD
checks = [
    ("Atomic requirements", "=COUNTA('Atomic requirements'!A2:A29)"),
    ("Publications", "=COUNTA(Publications!A2:A77)"),
    ("Statement–requirement assignments (sum of statement counts)", "=SUM('Atomic requirements'!G2:G29)"),
    ("Distinct extracted statements (from the extraction sheet)", 307),
]
for k, v in checks:
    ab.append([k, v])
    for c in ab[ab.max_row]:
        c.font = Font(name=F, size=10)
ab.cell(ab.max_row, 2).font = Font(name=F, size=10, color="0000FF")
ab.cell(ab.max_row, 3, "Source: Extraction sheet of the requirements analysis (one row per statement).").font = Font(name=F, size=9, italic=True)
ab.column_dimensions["A"].width = 100; ab.column_dimensions["B"].width = 12

# --- Reporting groups ---
rg = wb.create_sheet("Reporting groups")
data = []
for i, (g, t) in enumerate(GROUPS.items()):
    ids = ", ".join(r["atomic_id"] for r in rows if r["table1_row"] == g)
    data.append([g, t, ids, f"=COUNTIF('Atomic requirements'!C$2:C$29,A{i + 2})"])
sheet(rg, ["Group", "Statement", "Atomic requirements", "Number of atomic requirements"], data, [8, 70, 26, 14])

# --- Atomic requirements ---
ar = wb.create_sheet("Atomic requirements")
data = []
for r in rows:
    keys = [k.strip() for k in r["supporting_papers"].split(",") if k.strip()]
    data.append([r["atomic_id"], r["atomic_requirement"], r["table1_row"], r["concern"], r["status_symlit_v0.1.0"],
                 int(r["papers"]), int(r["statements"]), ranges(num[k] for k in keys)])
sheet(ar, ["ID", "Requirement", "Group", "Concern", "Coverage in Symlit v0.1.0", "Supporting publications",
           "Statement assignments", "Sources (numbers in 'Publications')"], data, [6, 60, 7, 18, 34, 12, 12, 40])

# --- Publications ---
pb = wb.create_sheet("Publications")
data = []
for k in order:
    cl, au, yr, ti, ve = LIT[k]
    sup = " ".join(r["atomic_id"] for r in rows if k in [x.strip() for x in r["supporting_papers"].split(",")])
    data.append([num[k], f"{cl}. {CLUSTERS[cl]}", surnames(au), yr, ti[0].upper() + ti[1:], ve, sup])
sheet(pb, ["No.", "Cluster", "Authors", "Year", "Title", "Venue", "Supports"], data, [6, 26, 36, 7, 60, 30, 30])

wb.save("S1_Requirements_Catalogue_Symlit.xlsx")
print("written")
