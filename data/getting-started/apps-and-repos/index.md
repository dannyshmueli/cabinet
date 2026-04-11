---
title: "Apps and Repos"
created: 2026-04-06T00:00:00.000Z
modified: 2026-04-06T18:10:00.000Z
tags:
  - example
  - guide
  - apps
order: 5
---

# Apps and Repos

Cabinet goes beyond markdown pages. You can embed full web applications, link external Git repositories, and create interactive tools that live right alongside your documentation. The sidebar becomes a launchpad for everything your team uses — no context switching required.

## Embedded Apps

Any directory that contains an `index.html` file (and no `index.md`) is treated as an embedded app. Cabinet renders it in an iframe, so it behaves like a standalone web page nested inside your workspace.

There are two modes:

### Standard Embedded Apps
The app renders in the main content area with the sidebar and AI panel still visible. Good for reference tools and dashboards you want to glance at while working on other pages.

### Full-Screen Apps (.app marker)
Add a `.app` marker file to the directory, and the app goes full-screen: the sidebar and AI panel auto-collapse to give the app maximum space. Perfect for complex tools that need the whole viewport.

**Examples in the Carousel Factory:**
- **Content Calendar** — Visual calendar for scheduling posts (full-screen)
- **Posts Editor** — Carousel slide builder and preview (full-screen)
- **Brand Kit** — Brand guidelines and asset reference

## Sidebar Icons

The sidebar uses color-coded icons to help you identify different content types at a glance:

| Icon | Color | Meaning |
|------|-------|---------|
| AppWindow | Green | Full-screen embedded app (has `.app` marker) |
| Globe | Blue | Standard embedded app (iframe with sidebar) |
| GitBranch | Orange | Linked Git repository |
| Link2 | Blue | Linked directory (non-repo symlink) |
| File | Default | Regular markdown page |
| Folder | Default | Directory with sub-pages |

## Linked Repositories

A `.repo.yaml` file in any data directory links it to a Git repository. This is powerful for teams that want their code and documentation side by side:

```yaml
name: my-project
local: /path/to/local/repo
remote: https://github.com/org/repo.git
source: both
branch: main
```

When a directory has a `.repo.yaml`, Cabinet knows it's connected to a codebase. Agents can use this to read and search source code in context when working on related documentation. It's like giving the AI a map to the actual code, not just the docs about the code.

The [[Example: Cabinet Carousel Factory]] has a `.repo.yaml` linking it to the Cabinet source repo — demonstrating how documentation and code live side by side.

## Symlinks and Load Knowledge

Cabinet uses direct symlinks to bring external folders into the KB. Right-click any item in the sidebar, choose **Load Knowledge**, and pick a folder. Cabinet creates a symlink pointing directly to it — no wrapper directories, no copies. The folder's contents appear as children in the tree.

For git repos, a `.repo.yaml` is written into the target folder so agents can read the code. All linked directories also get a `.cabinet.yaml` dotfile for metadata (title, tags). Both are hidden from the sidebar.

To remove a linked directory, right-click and choose **Unlink** — this removes only the symlink, not the original folder. See [[Symlinks and Load Knowledge]] for the full guide.

## Creating Your Own App

To add an embedded app to your workspace:

1. Create a new directory under your data folder
2. Add an `index.html` file with your app's markup, CSS, and JavaScript
3. (Optional) Add a `.app` marker file for full-screen mode
4. The app appears in the sidebar automatically

No build step, no deployment pipeline. Just HTML in a folder.

## Try It

Open the [[Example: Cabinet Carousel Factory]] in the sidebar and click on the Content Calendar or Posts Editor — they're full-screen embedded apps. Notice how the sidebar collapses to give them room.

---

Back to [[How to Use Cabinet]]
