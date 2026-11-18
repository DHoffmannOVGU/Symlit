# Getting started

### Download and run (no installation)

Download the file for your system from the
[latest release](https://github.com/DHoffmannOVGU/Symlit/releases/latest) and start it.
Symlit opens in your browser at http://127.0.0.1:5000; close the window to stop it.

| System | File |
| --- | --- |
| Windows | `symlit-<version>-windows-x64.exe` |
| macOS (Apple Silicon / Intel) | `symlit-<version>-macos-arm64` / `-macos-x64` |
| Linux | `symlit-<version>-linux-x64` |

The files are not code-signed yet, so your system warns on first start:

- **Windows:** "Windows protected your PC" → *More info* → *Run anyway*.
- **macOS:** in Terminal, `xattr -d com.apple.quarantine symlit-*` and `chmod +x symlit-*`,
  then run `./symlit-…`. (Or right-click → *Open* in Finder.)
- **Linux:** `chmod +x symlit-*`, then `./symlit-…`.

Your projects are stored per user, not next to the file: `%APPDATA%\Symlit` (Windows),
`~/Library/Application Support/Symlit` (macOS), `~/.local/share/symlit` (Linux). Settings from
[Configuration](Configuration) can go in a `.env` file in that folder.

## Run from source

### Requirements

**Node.js 20.19 or newer** and npm. Nothing else: with no configuration Symlit keeps its data
in an embedded PostgreSQL database ([PGlite](https://pglite.dev)) under `./data/`.

### Install and run

```bash
git clone https://github.com/DHoffmannOVGU/Symlit.git
cd Symlit
npm ci
npm run dev
```

Open http://localhost:5000. On first start Symlit creates a demo project.

## Take a tutorial

The project list offers six guided tutorials. Start with **Symlit basics**: it builds a small
drone model with you in about 25 minutes, from types and elements to validation, model rules,
the table view, patterns and export. The others each take one subject further, with an example
of their own:

| Tutorial | Example | What you learn |
| --- | --- | --- |
| Symlit basics | Delivery drone | the tool |
| Production with PPR | Shelf bracket | product, process, resource; tracing requirements |
| Calculate with attributes | 3D-printing quotes | attribute types, formulas, a rule on a calculated value |
| Classify and review | Control cabinet | rules that tag, combined conditions, rules for every model, the table |
| Structure and views | Espresso machine | relationship kinds, Generalization, several diagrams |
| Reuse and variants | Sensor nodes | type styles, copies, pattern libraries, a second metamodel, project files |

Steps tick off when the model shows their result. **Hint** helps you think, **Show me** points
at what to use, and a skipped step stays marked as skipped. Each lesson ends with one question,
and the last lesson of each tutorial is done without step-by-step instructions.

## Other ways to run it

**With a dedicated PostgreSQL server (Docker):**

```bash
docker compose up --build
```

This starts PostgreSQL 16 and Symlit at http://localhost:5000. Data is kept in the `symlit-db`
Docker volume.

**Production build:**

```bash
npm run build
npm start
```

See [Configuration](Configuration) for the database, port and host name settings.

## Next

Read [Concepts](Concepts), then create your first [project](Projects).
