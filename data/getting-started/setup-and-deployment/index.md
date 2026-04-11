---
title: "Setup and Deployment"
created: 2026-04-10T00:00:00.000Z
modified: 2026-04-10T00:00:00.000Z
tags:
  - guide
  - setup
  - deployment
order: 7
---

# Setup and Deployment

Cabinet stores everything as files on disk — no database, no cloud service. This page explains where those files live, how Cabinet initializes them, and how to configure a custom data directory.

## How Cabinet Initializes Data

On first launch, Cabinet seeds your data directory with default content:

- **Getting Started** guides (what you're reading now)
- **Carousel Factory** example workspace with agents, embedded apps, CSVs, and PDFs
- **Agent library** templates in `.agents/.library/`
- **data CLAUDE.md** that teaches AI agents the KB conventions

This seeding is non-destructive — it never overwrites existing files. On subsequent launches, Cabinet only adds new templates that ship with app updates. Your content is never touched.

## Where Data Lives

| Install method | Data directory |
|----------------|----------------|
| **Source** (`npx create-cabinet`) | `./cabinet/data/` (inside the project) |
| **Electron (macOS)** | `~/Library/Application Support/Cabinet/` |
| **Electron (Windows)** | `%APPDATA%/Cabinet/` |
| **Electron (Linux)** | `~/.local/share/cabinet/` |

## Custom Data Directory

Set the `CABINET_DATA_DIR` environment variable to point Cabinet at any directory:

```bash
# Source install — add to .env.local
CABINET_DATA_DIR=/path/to/your/data

# Electron — set before launching
CABINET_DATA_DIR=/path/to/your/data open -a Cabinet
```

When `CABINET_DATA_DIR` is set, Cabinet uses that path instead of the default. The directory is created automatically if it doesn't exist, and default content is seeded into it on first run.

## Running Cabinet

### Source Install (Development)

```bash
npx create-cabinet my-workspace
cd my-workspace
npm run dev:all
```

This starts two servers:
- **Next.js** on `http://localhost:3000` (the web UI)
- **Daemon** on `http://localhost:3001` (agents, jobs, terminal)

### Electron (Desktop App)

Download from [GitHub Releases](https://github.com/hilash/cabinet/releases) and open. Everything is bundled — no terminal required.

### Production

```bash
npm run build
npm start
```

## Backing Up Your Data

Since everything is files on disk, backing up is straightforward:

- **Git** — Cabinet auto-commits every edit. Push to a remote to back up.
- **File copy** — Copy the data directory to any backup location.
- **Symlink** — Point `CABINET_DATA_DIR` at a synced folder (Dropbox, iCloud Drive, etc.)

## Upgrading Cabinet

### Source install

```bash
cd my-workspace
npx create-cabinet upgrade --target .
```

This backs up your project, replaces app files with the new version, and runs `npm install`. Your `data/` directory is preserved.

### Electron

Cabinet checks for new releases automatically and prompts you when an update is available.

---

Back to [[How to Use Cabinet]]
