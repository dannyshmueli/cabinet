---
title: Getting Started
created: '2026-03-21T00:00:00.000Z'
modified: '2026-04-10T14:47:17Z'
tags:
  - guide
  - onboarding
  - files
  - visualizations
order: 0
---
# Welcome to Cabinet

The AI-first knowledge base and startup OS — shared memory between humans and AI agents.

No, we're not gonna spam your tokens. Built by team of ex-Apple engineers with security background, we want to Help you Execute at MAX level, without fluff and clean install.

We have 2 parts:

-   Knowledge Base - the brain. AI agents without memory of your projects are useless. Our point is that everything should be in the KB. you can put HTML apps, MD, pdfs - any files and apps you need for your website. Admin panel, iframes,.. the Knowledge Base is alive, kicking and your one stop shop!
    
-   World Class AI agents - you can time jobs, heartbeats. you have catalog of B2B and B2C plays and recommendation and well safe plays out of the box
    

## Features

-   **WYSIWYG Editor** — Rich text editing with formatting toolbar, tables, code blocks, and markdown source toggle
    
-   **Wiki-Links** — Type `<a data-wiki-link="true" data-page-name="Page Name" href="#page:page-name" class="wiki-link">Page Name</a>` to link between pages. Links render as styled clickable elements.
    
-   **Slash Commands** — Type `/` for quick formatting options
    
-   **AI Editor** — Right-side panel where Claude edits pages directly. Use `@PageName` to attach context
    
-   **Kanban Tasks** — Board and list views with Backlog, In Progress, Review, Done columns
    
-   **Agent Dashboard** — Run AI agents on tasks, monitor sessions
    
-   **Web Terminal** — Full Claude Code terminal in the browser (xterm.js + node-pty)
    
-   **Scheduled Jobs** — Cron-based automation with YAML configs
    
-   **Search** — `Cmd+K` full-text search across all pages
    
-   **Version History** — Git-backed auto-save with diff viewer and restore
    
-   **Drag & Drop** — Reorder pages in the sidebar, upload images by pasting/dragging
    
-   **Export** — Copy as MD/HTML, download .md, or print to PDF
    
-   **Dark/Light Mode** — Theme toggle with Inter + JetBrains Mono fonts
    
-   **PDF Viewer** — PDF files appear in the sidebar and open inline with the browser's native PDF renderer
    
-   **CSV Viewer/Editor** — CSV files render as interactive tables. Double-click cells to edit, add/delete rows and columns, toggle source view, and save with auto-commit
    
-   **Embedded Apps** — Directories with `index.html` render as embedded websites. Add a `.app` marker for full-screen mode (sidebar auto-collapses)
    
-   **Linked Repos** — Add `.repo.yaml` to link a KB directory to a Git repo. AI agents use this to read source code in context
    

## Load Knowledge

Right-click any item in the sidebar and choose **Load Knowledge** to link any folder from your machine. Cabinet creates a direct symlink in the KB pointing to your folder — its contents appear as children in the sidebar tree. For git repos, a `.repo.yaml` is written so agents can read the code in context. See [[Symlinks and Load Knowledge]] for details.

## Supported Files and Views

Cabinet treats a small set of formats as first-class views in the sidebar. Everything else can still live in the KB as a local asset, but it should usually be linked from a markdown page so the file has context.

| What you store | Typical files | How Cabinet shows it | Sidebar icon | If Cabinet cannot show it cleanly |
| --- | --- | --- | --- | --- |
| Markdown pages | `index.md`, `*.md` | WYSIWYG editor with markdown source toggle | `FileText` | Keep the page as the landing page and link the asset from it. |
| KB sections | Directories with `index.md` | Expandable folder tree with a page at the top | `Folder` or `GitBranch` if the directory is repo-linked | Add an `index.md` so the folder has a readable landing page. |
| CSV data | `.csv` | Interactive table editor with source view | `Table` | Open or download the raw file, or convert complex data into an HTML app. |
| PDF docs | `.pdf` | Inline PDF viewer | `FileType` | Open in a new tab or keep a markdown summary next to it. |
| Embedded websites | Directories with `index.html` and no `index.md` | Iframe in the main panel | `Globe` | Open in a new tab, or simplify it into a static page. |
| Full-screen tools | `index.html` + `.app` and no `index.md` | Full-screen iframe with the sidebar collapsed | `AppWindow` | Open in a new tab if the app needs more browser capability. |
| Linked codebases | `.repo.yaml` in a directory | Normal page or folder, with repo context for agents | `GitBranch` | Keep a markdown overview page and let agents use the linked repo behind it. |

Images, video, and other binary files can still live beside a page and be linked with relative paths. For the full support matrix and fallback rules, see [[Visualizations]].

## Sidebar Icons

<table class="border-collapse w-full" style="min-width: 75px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><th colspan="1" rowspan="1"><p>Icon</p></th><th colspan="1" rowspan="1"><p>Color</p></th><th colspan="1" rowspan="1"><p>Meaning</p></th></tr><tr><td colspan="1" rowspan="1"><p>AppWindow</p></td><td colspan="1" rowspan="1"><p>Green</p></td><td colspan="1" rowspan="1"><p>Full-screen embedded app (<code>.app</code> marker)</p></td></tr><tr><td colspan="1" rowspan="1"><p>Globe</p></td><td colspan="1" rowspan="1"><p>Blue</p></td><td colspan="1" rowspan="1"><p>Embedded website (<code>index.html</code>)</p></td></tr><tr><td colspan="1" rowspan="1"><p>GitBranch</p></td><td colspan="1" rowspan="1"><p>Orange</p></td><td colspan="1" rowspan="1"><p>Linked Git repo (<code>.repo.yaml</code>)</p></td></tr><tr><td colspan="1" rowspan="1"><p>Link2</p></td><td colspan="1" rowspan="1"><p>Blue</p></td><td colspan="1" rowspan="1"><p>Linked directory (non-repo symlink)</p></td></tr><tr><td colspan="1" rowspan="1"><p>FileType</p></td><td colspan="1" rowspan="1"><p>Red</p></td><td colspan="1" rowspan="1"><p>PDF file</p></td></tr><tr><td colspan="1" rowspan="1"><p>Table</p></td><td colspan="1" rowspan="1"><p>Green</p></td><td colspan="1" rowspan="1"><p>CSV file</p></td></tr><tr><td colspan="1" rowspan="1"><p>Code</p></td><td colspan="1" rowspan="1"><p>Violet</p></td><td colspan="1" rowspan="1"><p>Source code file</p></td></tr><tr><td colspan="1" rowspan="1"><p>Image</p></td><td colspan="1" rowspan="1"><p>Pink</p></td><td colspan="1" rowspan="1"><p>Image file</p></td></tr><tr><td colspan="1" rowspan="1"><p>Video</p></td><td colspan="1" rowspan="1"><p>Cyan</p></td><td colspan="1" rowspan="1"><p>Video file</p></td></tr><tr><td colspan="1" rowspan="1"><p>Music</p></td><td colspan="1" rowspan="1"><p>Amber</p></td><td colspan="1" rowspan="1"><p>Audio file</p></td></tr><tr><td colspan="1" rowspan="1"><p>Folder</p></td><td colspan="1" rowspan="1"><p>Gray</p></td><td colspan="1" rowspan="1"><p>Regular directory</p></td></tr><tr><td colspan="1" rowspan="1"><p>FileText</p></td><td colspan="1" rowspan="1"><p>Gray</p></td><td colspan="1" rowspan="1"><p>Markdown page</p></td></tr></tbody></table>

## Keyboard Shortcuts

<table class="border-collapse w-full" style="min-width: 50px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><th colspan="1" rowspan="1"><p>Shortcut</p></th><th colspan="1" rowspan="1"><p>Action</p></th></tr><tr><td colspan="1" rowspan="1"><p><code>Cmd+S</code></p></td><td colspan="1" rowspan="1"><p>Force save</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>Cmd+K</code></p></td><td colspan="1" rowspan="1"><p>Search</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>Cmd+``</code></p></td><td colspan="1" rowspan="1"><p>Toggle terminal</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>Cmd+Shift+A</code></p></td><td colspan="1" rowspan="1"><p>Toggle AI panel</p></td></tr></tbody></table>

---

# How to Use Cabinet

Cabinet is an AI-first knowledge base where everything lives as files on disk. There's no database, no cloud lock-in, and no mystery about where your data goes. You write pages in markdown, organize them in a tree, and let AI agents help you edit and maintain the whole thing.

This guide section walks through every major feature. If you're new here, start from the top and work your way down. If you already know what you're looking for, jump straight to the relevant page.

## What Cabinet Can Do

-   **Rich text editing** with a WYSIWYG editor that feels like a proper writing tool, not a code editor with delusions of grandeur
    
-   **AI-powered editing** via Claude, which reads your pages and makes targeted changes on command
    
-   **Full-text search** across every page in the knowledge base (Cmd+K)
    
-   **Wiki-links** between pages using `<a data-wiki-link="true" data-page-name="Page Name" href="#page:page-name" class="wiki-link">Page Name</a>` syntax
    
-   **Git-backed version history** so every edit is recoverable
    
-   **Embedded web apps** that run inside the sidebar as iframes or full-screen tools
    
-   **Linked repositories** that connect KB sections to real Git repos
    
-   **Kanban task boards** for tracking work
    
-   **Scheduled jobs** for automated recurring tasks
    
-   **A web terminal** for running Claude Code directly in the browser
    

## The Guides

Each sub-page covers a specific feature area in detail:

1.  [Editor Tips](#page:editor-tips) — The WYSIWYG editor, slash commands, markdown toggle, and tables
    
2.  [AI Editor Guide](#page:ai-editor-guide) — The AI panel, @mentions, example prompts, and how Claude edits pages
    
3.  [Search and Navigation](#page:search-and-navigation) — Cmd+K search, wiki-links, sidebar tree, and image uploads
    
4.  [Version History](#page:version-history) — Git auto-save, the diff viewer, and restoring previous versions
    
5.  [Apps and Repos](#page:apps-and-repos) — Embedded apps, full-screen mode, and linked repos
    
6.  [Symlinks and Load Knowledge](#page:symlinks-and-load-knowledge) — Direct symlinks, .cabinet.yaml, .repo.yaml, and CABINET\_DATA\_DIR
    
7.  [Tasks and Jobs](#page:tasks-and-jobs) — Kanban boards, agent sessions, the web terminal, and scheduled jobs
    

## The Example Workspace

Cabinet ships with an example workspace — the **Carousel Factory** — a real content marketing pipeline that uses agents, embedded apps, CSVs, PDFs, and linked repos. The guides reference it throughout, so feel free to explore it as you learn.

---

Last Updated: 2026-04-10
