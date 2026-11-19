"""Fig. 1: composition of domain metamodels through a shared PPR core (project level)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 7})
BLUE, GREEN, RED, GREY = "#2563eb", "#16a34a", "#dc2626", "#475569"
fig, ax = plt.subplots(figsize=(3.35, 2.6), dpi=600)
ax.set_xlim(0, 100); ax.set_ylim(0, 82); ax.axis("off")


def box(x, y, w, h, color, kind, title, lines):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=1.6",
                                fc=color + "14", ec=color, lw=0.9))
    ax.text(x + 2, y + h - 2.2, kind, color=color, fontsize=4.8, va="top", fontweight="bold")
    ax.text(x + 2, y + h - 6.2, title, color="#111827", fontsize=6.6, va="top", fontweight="bold")
    for i, line in enumerate(lines):
        ax.text(x + 2, y + h - 11.4 - i * 3.9, line, color="#374151", fontsize=5.2, va="top")


def ref(x0, y0, x1, y1, label, side):
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle="-|>", color=GREY, lw=0.8, mutation_scale=7, linestyle=(0, (3, 1.6))))
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    ax.text(mx + (1.2 if side == "r" else -1.2), my, label, color=GREY, fontsize=5.0, style="italic",
            ha="left" if side == "r" else "right", va="center")


# layer labels

box(20, 60, 60, 20, BLUE, "METAMODEL", "PPR core",
    ["owns Product, Process, Resource", "and their relationships"])
box(2, 30, 44, 23, RED, "METAMODEL", "Resilience",
    ["owns its types, attributes and", "relationships; specialises or", "relates core types"])
box(54, 30, 44, 23, GREEN, "METAMODEL", "Sustainability",
    ["owns its types, attributes and", "relationships; specialises or", "relates core types"])
box(20, 1, 60, 19, GREY, "INSTANCE PROJECT", "Production-system model",
    ["each element uses a type defined in a", "domain metamodel or the shared core"])

ref(30, 53, 40, 60, "references", "l")
ref(70, 53, 60, 60, "references", "r")
ref(40, 20, 30, 30, "references", "l")
ref(60, 20, 70, 30, "references", "r")

fig.savefig("figures/fig1.png", dpi=600, bbox_inches="tight", pad_inches=0.02)
print(fig.get_size_inches())
