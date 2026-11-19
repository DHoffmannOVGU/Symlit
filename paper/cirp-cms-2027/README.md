# Material for the CIRP CMS 2027 paper

"Symlit: Composing Domain Metamodels for Resilience and Sustainability in Production Systems" (D. Hoffmann, C. Binder, A. Lüder)

The example was built with Symlit **v0.1.0** (commit `e58da18`).

| File | Content |
|---|---|
| [`requirements-catalogue.md`](requirements-catalogue.md), `S1_Requirements_Catalogue_Symlit.xlsx` | **Supplementary Material S1 – Requirements Catalogue for Symlit** (Markdown and Excel with sheets About, Reporting groups, Atomic requirements, Publications): derivation, the eight reporting groups R1–R8 (Table 1), the 28 atomic requirements A1–A28 with wording, group, number of supporting papers and statements, status in v0.1.0 (Table 2) and sources, and the 76 publications. |
| `literature.csv`, `literature.py`, `make_catalogue.py`, `make_s1_xlsx.py` | The 76 publications (cluster, authors, year, title, venue, supported requirements) and the script that generates the catalogue from `requirements-mapping.csv`. |
| `plastics-recycling-lab.symlit.json` | Fig. 2: author-built abstraction of the plastics recycling laboratory, composed as in Fig. 1: PPR core, Resilience and Sustainability metamodels (both reference the core) and the instance project of the shredding step (references both). Export with referenced metamodels; import via *Project list → Import*. |
| `build_recycling_composed.py` | Builds the four projects through the REST API of a running Symlit (`npm run dev`, http://127.0.0.1:5000) and runs the conformance check (no issues). Opening the model in the editor calculates 2.85 kg CO2/h for the shredder and 0.095 kg CO2/kg for Shredding. |
| `make_fig1.py`, `compose_fig2.py`, `figures/` | Fig. 1 (project-level composition) and Fig. 2 (Symlit screenshots with overlays; values read from the export). |
| `requirements-mapping.csv` | Machine-readable form of the catalogue (one row per atomic requirement, sources as keys into `literature.csv`). |
