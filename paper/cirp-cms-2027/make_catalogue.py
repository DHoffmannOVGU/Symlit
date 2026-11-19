"""Writes requirements-catalogue.md and literature.csv from requirements-mapping.csv and literature.py."""
import csv, re
from literature import LIT, CLUSTERS

GROUPS = {
    "R1": "Domain engineers define lean, task-specific languages with little training",
    "R2": "A concept base such as PPR is reused and extended by new concerns without changing standards or code",
    "R3": "Language and models are defined in one environment and evolve while models are incomplete or inconsistent",
    "R4": "Variants and views of a system coexist with traceable dependencies",
    "R5": "Models are checked against the language and user-defined constraints, with clear feedback",
    "R6": "Models are exchanged in open formats and with engineering standards",
    "R7": "Browser use without installation, teaching, controlled team work, operation on premises",
    "R8": "Programs and agents use standard, metamodel-aware operations; changes are validated and stay under human control",
}

def surnames(a):
    return re.sub(r"\s+[A-ZÁ-Ž][A-Za-zÁ-Ž]{0,2}(?=,|$| \()", "", a)


def ranges(ns):
    ns, out, i = sorted(ns), [], 0
    while i < len(ns):
        j = i
        while j + 1 < len(ns) and ns[j + 1] == ns[j] + 1:
            j += 1
        out.append(str(ns[i]) if j == i else (f"{ns[i]}, {ns[j]}" if j == i + 1 else f"{ns[i]}–{ns[j]}"))
        i = j + 1
    return ", ".join(out)

order = sorted(LIT, key=lambda k: (LIT[k][0], LIT[k][1].split(",")[0].lower(), LIT[k][2]))
num = {k: i + 1 for i, k in enumerate(order)}
rows = list(csv.DictReader(open("requirements-mapping.csv", encoding="utf8")))


def status(s):
    return s.replace("partly met:", "partly met –").replace("open:", "open –").replace("met in the local edition;", "met in the local edition;")


out = []
w = out.append
w("# Supplementary Material S1 – Requirements Catalogue for Symlit\n")
w("Supplement to D. Hoffmann, C. Binder, A. Lüder: *Symlit: Composing Domain Metamodels for Resilience and "
  "Sustainability in Production Systems*, CIRP CMS 2027.\n")
w("## Derivation\n")
w("76 publications from six areas (clusters A–F below) were read in full. 307 statements on needs and shortcomings "
  "were extracted with page references, coded deductively and inductively, and consolidated into 28 **atomic "
  "requirements** (one need each). The corpus contained 307 distinct extracted statements. A statement could support "
  "more than one atomic requirement (193 statements did), yielding 568 statement–requirement assignments; the "
  "statement counts per requirement below count these assignments. Every atomic requirement is supported by at least two independent publications. "
  "For reporting in the paper, the atomic requirements are arranged in eight **reporting groups** (R1–R8, Table 1 of "
  "the paper) by the tool capability they concern; Table 2 of the paper assesses Symlit v0.1.0 per atomic requirement. "
  "Coding was performed by one coder and reviewed by the authors. The coverage assessment states what v0.1.0 provides; "
  "the supporting publications establish why a requirement matters, not that Symlit meets it.\n")
w("## Reporting groups\n")
w("| Group | Statement | Atomic requirements |\n|---|---|---|")
for g, t in GROUPS.items():
    ids = [r["atomic_id"] for r in rows if r["table1_row"] == g]
    w(f"| {g} | {t} | {', '.join(ids)} |")
w("")
w("## Atomic requirements\n")
w("Papers / statements: number of supporting publications and extracted statements. Sources refer to the literature "
  "list below.\n")
w("| ID | Requirement | Group | Concern | Papers / statements | Symlit v0.1.0 | Sources |\n|---|---|---|---|---|---|---|")
for r in rows:
    keys = [k.strip() for k in r["supporting_papers"].split(",") if k.strip()]
    src = ranges(num[k] for k in keys)
    w(f"| {r['atomic_id']} | {r['atomic_requirement']} | {r['table1_row']} | {r['concern']} | "
      f"{r['papers']} / {r['statements']} | {status(r['status_symlit_v0.1.0'])} | {src} |")
w("")
w("## Literature (76 publications)\n")
for c, name in CLUSTERS.items():
    w(f"**{c} – {name}**\n")
    for k in order:
        cl, au, yr, ti, ve = LIT[k]
        if cl == c:
            w(f"[{num[k]}] {surnames(au)} ({yr}). {ti[0].upper() + ti[1:]}. *{ve}*.  ")
    w("")
open("requirements-catalogue.md", "w", encoding="utf8").write("\n".join(out))

with open("literature.csv", "w", newline="", encoding="utf8") as f:
    wr = csv.writer(f)
    wr.writerow(["no", "key", "cluster", "authors", "year", "title", "venue", "supports"])
    for k in order:
        cl, au, yr, ti, ve = LIT[k]
        sup = [r["atomic_id"] for r in rows if k in [x.strip() for x in r["supporting_papers"].split(",")]]
        wr.writerow([num[k], k, cl, surnames(au), yr, ti, ve, " ".join(sup)])
print(len(order), "publications;", sum(1 for k in order if not any(k in r["supporting_papers"] for r in rows)), "unused")
