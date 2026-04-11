---
title: Symlinks and Load Knowledge
created: '2026-04-11T00:00:00.000Z'
modified: '2026-04-11T00:00:00.000Z'
tags:
  - guide
  - symlinks
  - knowledge
order: 6
---

# Symlinks and Load Knowledge

Cabinet uses direct symlinks to bring external folders into your Knowledge Base without copying or moving anything. The folder stays where it is on disk — Cabinet just creates a pointer to it.

## How Load Knowledge Works

1. Right-click any item in the sidebar
2. Choose **Load Knowledge**
3. Pick a folder on your machine (or paste the path)
4. Optionally set a display name
5. Click **Load**

Cabinet creates a symlink in the KB:

```
data/my-project -> /Users/me/Projects/my-project
```

The folder's contents appear directly as children in the sidebar tree. No wrapper directories, no extra nesting.

## What Gets Written

Cabinet writes two hidden dotfiles into the target folder:

### `.cabinet.yaml`

Every linked folder gets this. It stores display metadata for the KB.

```yaml
title: My Project
tags:
  - knowledge
created: '2026-04-11T00:00:00.000Z'
```

### `.repo.yaml` (git repos only)

If the folder is a git repo, Cabinet auto-detects the branch and remote and writes a `.repo.yaml` so AI agents can read the source code in context.

```yaml
name: my-project
local: /Users/me/Projects/my-project
remote: https://github.com/me/my-project.git
source: both
branch: main
```

If a `.repo.yaml` already exists in the folder, Cabinet skips writing it.

Both files are dotfiles — hidden from the sidebar by default.

## Sidebar Icons

Linked directories show distinct icons:

- **GitBranch** (orange) — linked git repo (has `.repo.yaml`)
- **Link2** (blue) — linked non-repo directory

## Unlinking

To remove a linked folder from the KB:

1. Right-click the linked item in the sidebar
2. Choose **Unlink**

This removes only the symlink from the KB. The original folder and all its files are untouched. The `.cabinet.yaml` in the target folder is also cleaned up.

## Changing the Data Directory

By default, Cabinet stores all content in `./data` (dev mode) or a platform-specific app data path (Electron). You can override this with the `CABINET_DATA_DIR` environment variable:

```bash
CABINET_DATA_DIR=/path/to/my/kb npm run dev
```

You can also make `data/` itself a symlink pointing elsewhere — the tree builder follows symlinks transparently.

## Tips

- Linked folders with an `index.html` (and no `index.md`) render as embedded websites
- Add a `.app` marker for full-screen mode
- If the target folder has its own `index.md`, Cabinet uses it as the page content
- Agents can discover linked repos by reading `.repo.yaml` in any parent directory

---

Back to [[How to Use Cabinet]]
