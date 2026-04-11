# Progress

[2026-04-11] Added Storage tab to Settings with data directory picker. Users can view the current data dir path, browse for a new one, or type a path manually. The setting is persisted to `.cabinet-install.json` and read by `getManagedDataDir()` at startup (env var still takes priority). A restart banner shows when the path changes. Also updated the About tab to show the actual data dir path.

[2026-04-11] Added Mermaid diagram viewer for .mermaid and .mmd files. Renders diagrams with the mermaid library, supports source toggle, copy source, and SVG export. Follows the current Cabinet theme (dark/light). Shows error state with fallback to source view if rendering fails.

[2026-04-11] Updated documentation for direct symlinks: shortened Load Knowledge section in getting-started, updated apps-and-repos page, added new "Symlinks and Load Knowledge" guide page under getting-started, updated data/CLAUDE.md linked repos section, and added Link2 + new file type icons to the sidebar icons table.

[2026-04-11] Added source/code viewer, image viewer, and video/audio player as first-class file viewers. Code files (.js, .ts, .py, .json, .yaml, .sh, .sql, +25 more extensions) open in a dark-themed source viewer with line numbers, copy, download, wrap toggle, and raw view. Images (.png, .jpg, .gif, .webp, .svg) render centered on a dark background with download/open-in-tab. Video/audio (.mp4, .webm, .mp3, .wav) use native HTML5 players. Tree builder now classifies files by extension and shows type-specific sidebar icons. Added node_modules and other build dirs to the hidden entries filter.

[2026-04-11] Load Knowledge now creates direct symlinks (`data/my-project -> /external/path`) instead of wrapper directories with a `source` symlink inside. Metadata is stored as dotfiles (`.cabinet.yaml`, `.repo.yaml`) in the target directory. Added `isLinked` flag to TreeNode for UI differentiation — linked dirs show a Link2 icon and "Unlink" instead of "Delete" in context menus. Updated `readPage` with `.cabinet.yaml` fallback for linked dirs without `index.md`, and `deletePage` to safely unlink symlinks while cleaning up `.cabinet.yaml`.

[2026-04-11] Added "Copy Relative Path" and "Copy Full Path" options to sidebar context menus. TreeNode menu gets both options; Knowledge Base root menu gets "Copy Full Path". Full path is resolved via `/api/health` with a client-side cache.

[2026-04-11] Added expandable setup guides to the Settings > Providers tab. Each CLI provider now has a "Guide" button that reveals step-by-step installation instructions with numbered steps, terminal commands (with copy buttons), "Open terminal" button, and external links (e.g. Claude billing). Also added a "Re-check providers" button. Matches the onboarding wizard's setup guide UX.

[2026-04-11] Added agent provider health status to the status bar. The health indicator now shows amber "Degraded" when no agent providers are available. Clicking the status dot opens a popup showing App Server, Daemon, and Agent Providers sections with per-provider status (Ready / Not logged in / Not installed). Provider status is fetched once on mount and refreshed each time the popup opens, with 30s server-side caching to avoid excessive CLI spawning.

[2026-04-11] Added Codex CLI login verification to onboarding agent provider step. Health check now runs `codex login status` to detect authentication (e.g. "Logged in using ChatGPT") instead of assuming authenticated when the binary exists. Updated the Codex setup guide to use `npm i -g @openai/codex` and simplified steps to: install, login, verify.

[2026-04-11] Updated Discord invite link to new permanent invite (discord.gg/hJa5TRTbTH) across README, onboarding wizard, status bar, settings page, and agent job configs.

[2026-04-10] Redesigned onboarding step 1 from "Tell me about your project" to "Welcome to your Cabinet". Added name and role fields (role uses predefined pill buttons: CEO, Marketer, Engineer, Designer, Product, Other). Moved goals question to step 2. Step 1 now requires both name and company name to proceed.

[2026-04-10] Fixed duplicate-key crash when a standalone .md file and a same-named directory coexist (e.g. `harry-potter.md` + `harry-potter/`). Tree builder now skips the standalone file when a directory exists. Link-repo API now auto-promotes standalone .md pages to directories with index.md when loading knowledge into them. Added warning banner to Load Knowledge dialog when the target page already has sub-pages.

[2026-04-10] Removed the first-launch data directory dialog from Electron. Cabinet now silently seeds default content (getting-started, example-cabinet-carousel-factory, agent library) into the managed data dir on every launch. Also fixed the build script referencing a wrong directory name (`cabinet-example` → `example-cabinet-carousel-factory`) and added `index.md` to the seed content. Created a new "Setup and Deployment" guide page covering data directory locations, custom `CABINET_DATA_DIR`, and upgrade instructions. Rewrote all getting-started pages to remove Harry Potter references and use the Carousel Factory example instead.

[2026-04-10] Renamed "Add Symlink" to "Load Knowledge" across the UI. Redesigned the dialog: top section has folder picker and name (for everyone), collapsible "For Developers" section exposes remote URL and description fields with explanation about symlinks and .repo.yaml. API now auto-detects git repos — only creates .repo.yaml for actual repos, plain directories just get the symlink. Updated getting-started docs.

[2026-04-10] Updated server health indicator to track both servers independently — App Server (Next.js) and Daemon (agents, jobs, terminal). Shows green "Online" when both are up, amber "Degraded" when only the daemon is down, and red "Offline" when the app server is down. Popup shows per-server status with colored dots and explains which features are affected. Added `/api/health/daemon` proxy route and updated middleware to allow all health endpoints.

[2026-04-10] Made "Add Symlink" available at every level of the sidebar tree, not just the root Knowledge Base label. Added the option to tree-node.tsx context menu, added parentPath prop to LinkRepoDialog, and updated the link-repo API to support creating symlinked repos inside subdirectories.

[2026-04-10] Restored "Add Symlink" option to the Knowledge Base context menu. It was lost when the sidebar was restructured to nest KB under Cabinet (commit e011d02). Moved LinkRepoDialog and its state from sidebar.tsx into tree-view.tsx where the context menu lives.

[2026-04-10] Added all 7 sidebar icon types to the example workspace: Posts Editor (full-screen .app with carousel slide previews, placeholder images, prompts, and platform/status filters), Brand Kit (embedded website without .app — Globe icon), media-kit.pdf (PDF — FileType icon). Updated .gitignore to track the renamed example directory and agent library templates.

[2026-04-10] Replaced Harry Potter example workspace with "Cabinet Carousel Factory" — a TikTok/Instagram/LinkedIn carousel content factory for marketing Cabinet itself. Includes: index.md (HQ page with brand guide, pipeline, hook formulas, posting schedule), competitors.csv (15 KB competitors updated daily by cron), content-ideas.csv (carousel backlog), content-calendar full-screen HTML app (.app) with Cabinet website design language (warm parchment, serif display, terminal chrome), .repo.yaml linking to Cabinet repo. Created 4 new agent personas (Trend Scout, Script Writer, Image Creator, Post Optimizer) and 3 scheduled jobs (morning briefing, daily competitor scan, weekly digest). Deleted old HP-themed content and jobs.

[2026-04-10] Fixed onboarding wizard to show all 20 agent library templates during fresh start, grouped by department (Leadership, Marketing, Engineering, etc.). Previously only 2-4 agents were shown via hardcoded suggestions. Now fetches templates from /api/agents/library and uses keyword matching against company description to smart pre-check relevant agents.

[2026-04-10] Pinned domain tag and agent count to the bottom of each carousel card using flex-col with mt-auto, and set a fixed card height so the footer row aligns consistently across all cards.

[2026-04-10] Made the "cabinet" logo in the sidebar header clickable — clicking it now navigates to the home screen, matching the behavior of clicking the Cabinet section label.

[2026-04-10] Added infinite carousel of "Cabinets" at the bottom of the home screen — 50 pre-made zero-human team templates with name, description, agent count, and color-coded domain badges. Carousel auto-scrolls and pauses on hover.

[2026-04-10] Changed home screen prompt input from single-line input to textarea. Enter submits the conversation, Ctrl/Cmd+Enter inserts a new line. Added a keyboard hint (⌘ + ↵ new line) next to the send button.

[2026-04-10] Added home screen that appears when clicking "Cabinet" in the sidebar. Shows a time-based greeting with the company name, a text input for creating tasks, and quick action buttons. Submitting a prompt starts a conversation with the General agent via /api/agents/conversations and navigates directly to the conversation view. Added conversationId to SelectedSection so the agents workspace auto-selects and opens the new conversation. Default app route changed from agents to home.

[2026-04-10] Made Knowledge Base sidebar item editable. Added data/index.md as the root KB page, a root /api/pages route for parameterless access, and split the KB sidebar button so the chevron toggles expand/collapse while clicking the label opens the page in the editor.

[2026-04-10] Unified sidebar: Agents and Knowledge Base nested under collapsible "Cabinet" parent. All items now use identical TreeNode styles (13px text, gap-1.5, h-4 w-4 icons, depth-based paddingLeft indentation, same hover/active classes). KB tree nodes render at depth 2 so they align with agent child items.

[2026-04-10] Fix false "Update 0.2.6 available" shown when already on 0.2.6. Root cause: stale cabinet-release.json (0.2.4) was used as current version instead of package.json. Updated the manifest and made readBundledReleaseManifest always use package.json version as source of truth.

[2026-04-10] Added Connect section to the About settings tab with Discord link (recommended) and email (hi@runcabinet.com).

[2026-04-10] Added default White and Black themes (neutral, no accent color) to the appearance tab. Reduced blur on coming-soon overlays from 3px to 2px with higher opacity.

[2026-04-10] Notifications settings tab now shows a blurred preview with "Coming Soon" overlay, matching the integrations tab treatment.

[2026-04-10] Integrations settings tab now shows a blurred preview of the MCP servers and scheduling UI with a centered "Coming Soon" overlay card on top.

[2026-04-10] Moved About section from Providers tab into its own About tab in settings with correct version (0.2.6) and product info.

[2026-04-10] Settings page tabs now sync with the URL hash (e.g. #/settings/updates, #/settings/appearance). Browser back/forward navigates between tabs. Added min-h-0 + overflow-hidden to the ScrollArea so tab content is properly scrollable.

[2026-04-09] Fix pty.node macOS Gatekeeper warning: added xattr quarantine flag removal before ad-hoc codesigning of extracted native binaries in Electron main process.

[2026-04-09] Added `export const dynamic = "force-dynamic"` to all `/api/system/*` route handlers. Without this, Next.js could cache these routes during production builds, potentially serving stale update check results and triggering a false "update available" popup on fresh installs.

[2026-04-09] Added Apple Developer certificate import step to release workflow for proper codesigning and notarization in CI. Deduplicated getNvmNodeBin() in cabinet-daemon.ts to use the shared nvm-path.ts utility.

[2026-04-09] Cap prompt containers to max-h with vertical-only scrolling. Added "Open Transcript" button to the prompt section in conversation-result-view (matching the existing one in Artifacts). Also added anchor link on the full transcript page.

[2026-04-09] Apply markdown rendering to Prompt section on transcript page via ContentViewer. Extracted parsing logic into shared transcript-parser.ts so server components can pre-render text blocks as HTML (client hydration doesn't work on this standalone page). Both prompt and transcript text blocks now render with full prose markdown styling.

[2026-04-09] Improved transcript viewer: pre-processes embedded diff headers glued to text, detects cabinet metadata blocks (SUMMARY/CONTEXT/ARTIFACT inside fenced blocks), renders orphaned diff lines with proper green/red coloring, renders markdown links and inline code in text blocks, styles token count as a badge footer. Also added +N/-N addition/removal counts in diff file headers.

[2026-04-09] Rich transcript viewer: diff blocks show green/red for additions/removals with file headers, fenced code blocks get language labels, structured metadata lines (SUMMARY, CONTEXT, ARTIFACT, DECISION, LEARNING, GOAL_UPDATE, MESSAGE_TO) render as colored badges. Copy button added to transcript section.

[2026-04-09] Render prompt as markdown on the transcript page too, with a copy button. Server-side markdown rendering via markdownToHtml, matching the prose styling used elsewhere.

[2026-04-09] Render conversation prompt as markdown in the ConversationResultView panel instead of plain text. Uses the existing render-md API endpoint with prose styling, falling back to plain text while loading.

[2026-04-09] Unified toolbar controls across all file types. Extracted Search, Terminal, AI Panel, and Theme Picker into a shared `HeaderActions` component. CSV, PDF, and Website/App viewers now include these global controls in their toolbars, matching the markdown editor experience.

[2026-04-09] Added "Open in Finder" option to each sidebar tree item's right-click context menu. Reveals the item in Finder (macOS) or Explorer (Windows) instead of only supporting the top-level knowledge base directory.

[2026-04-09] Fixed Claude CLI not being found in Electron DMG builds. The packaged app inherits macOS GUI PATH which lacks NVM paths. Added NVM bin detection (scans ~/.nvm/versions/node/) to RUNTIME_PATH in provider-cli.ts, enrichedPath in cabinet-daemon.ts, and commandCandidates in claude-code provider.


[2026-04-10] Added send icon to each agent card in the Team Org Chart. Clicking it opens the agent's workspace with the composer focused, letting users quickly send a task to any agent directly from the org chart. Also added to the CEO card.

[2026-04-10] Replaced send-icon navigation with a quick-send popup dialog on the Org Chart. Clicking the send icon on any agent card opens a blurred-backdrop modal with the full chat composer (textarea, @mentions, keyboard shortcuts). Submitting navigates to the conversation view.

[2026-04-10] Added in-app toast notifications for agent task completion/failure. When a conversation finishes, a slide-in toast appears in the bottom-right with agent emoji, status, and title. Clicking navigates to the conversation. Uses an in-memory notification queue drained by SSE. Documented in notifications.md.

[2026-04-10] Added notification sounds for task completion/failure toasts. Uses Web Audio API to synthesize tones — ascending chime for success, descending tone for failure. No audio files needed.

[2026-04-03] Created LLM Comparison embedded app at /data/llm-comparison/ with .app marker for full-screen mode. Interactive side-by-side comparison of 13 LLMs (Claude, GPT, Gemini, DeepSeek, Llama, Grok, Mistral) with benchmark bar charts, feature diff grid, pricing calculator, and tier filters.

[2026-04-03] Removed Chat section from sidebar and routing. Removed Goals tab from agent detail view. Added collapsible agent list in sidebar under Agents — each agent shows emoji, name, and active status dot, clicking navigates directly to the agent detail.

[2026-04-03] Added General agent as a permanent entry at the top of the sidebar agent list (always present, not fetched from API). Editor agent is sorted to appear second, before the rest of the agents.

[2026-04-03] Updated PRD to reflect current state: removed Chat and Goals sections, documented collapsible agent list in sidebar with General (always present) and Editor (sorted first) as defaults, updated sidebar diagram, removed chat storage/API/components references, simplified implementation phases, updated glossary.

[2026-04-03] Fixed AI panel terminal height: when a Claude session is running, the terminal now fills all available vertical space (flex-1) instead of being capped at 300px. Uses min-h-[200px] as a floor.

[2026-04-03] Agent Sessions tab now spawns a real Claude Code terminal (WebTerminal) instead of calling the headless API. When sending a prompt, a live interactive terminal session appears with the agent's persona as context — same component used by the AI Editor panel. Session list sidebar shows a spinning indicator for live sessions.

[2026-04-03] Made agent Definition tab fully editable: click any field (department, type, heartbeat, workspace) to edit inline. Persona instructions have an Edit button that opens a textarea. Removed budget and channels fields. Jobs tab now supports add/remove/edit: create new jobs with name+cron, click cron to edit schedule inline, toggle enabled/disabled, delete jobs.

[2026-04-03] Added CronPicker component with 15 human-readable presets (Every hour, Weekdays at 9am, etc.) plus Custom input. Used in: agent heartbeat field (Definition tab), add-job form (Jobs tab), and inline job schedule editor. Cron values show both the expression and human label.

[2026-04-03] Added job description/prompt field — jobs now have a body that serves as the prompt sent to the agent. Visible as a preview on the job card, editable in the expanded edit form. Add-job form also has a prompt textarea. Persona instructions now render as formatted markdown (prose) using a /api/ai/render-md endpoint, with click-to-edit switching to raw markdown textarea. Added @tailwindcss/typography for prose styling.

[2026-04-03] Replaced emoji with Lucide icons for agents in the sidebar. Each agent slug maps to a specific icon: General=Bot, Editor=Pencil, CEO=Crown, Content Marketer=Megaphone, SEO=Search, QA=ShieldCheck, Sales=BarChart3, Developer=Code. Unknown agents fall back to Bot icon.

[2026-04-03] Removed Skills tab from agent detail view. Added 14 new agent library templates (20 total): COO, CFO, CTO, Product Manager, UX Designer, Data Analyst, Social Media Manager, Growth Marketer, Customer Success, Copywriter, DevOps Engineer, People Ops, Legal Advisor, Researcher. Each has full persona.md with role description, responsibilities, and working style. Updated sidebar icon mapping for all new agent types.

[2026-04-03] Added light cabinet icon as sidebar logo (public/logo-light.png) next to 'Cabinet' text. Updated favicon to match.

[2026-04-06] Built "The Daily Prophet" — a Harry Potter-themed real-time newspaper dashboard for Weasleys' Wizard Wheezes (data/cabinet-example/candy-counter/index.html). Features: UnifrakturMaguntia masthead, parchment texture, rotating banner headlines, 3-column newspaper layout with shop metrics (count-up animation + sparklines), order dispatch cards (expandable), bestseller leaderboard with bar charts, live clock, status indicators, scrolling classifieds ticker, confetti easter egg, and full accessibility (ARIA live regions, keyboard nav, reduced-motion support). Single self-contained HTML file.

[2026-04-03] Fixed scheduled plays never executing: added cron registration for plays with schedule triggers in play-manager.ts. Plays with schedule triggers now get registered with node-cron on app startup (via /api/agents/personas init) and re-registered when plays are created/updated. Added "schedule" case to trigger-engine.ts. Rewrote README.md to match runcabinet.com website style with demo video, problem/solution framing, feature matrix, comparison table, and strong CTAs.

[2026-04-06] Built "The Laboratory" — a Harry Potter-themed R&D experiment tracking console for Weasleys' Wizard Wheezes (data/cabinet-example/prank-lab/index.html). Features: phosphor green CRT monitor aesthetic with scanline overlay, 4 SVG circular gauges with brass bezels (animate from 0, fluctuate live), terminal-style experiment log with color-coded timeline and typing animation, 4 active experiment cards with status badges and progress bars, environment monitoring strip, "Run Experiment" button with random outcomes and confetti on success, emergency shutdown sequence with red flash and countdown overlay, full accessibility (ARIA roles, reduced-motion, keyboard nav). Single self-contained HTML file.

[2026-04-06] Built "The Marauder's Map" — an animated interactive store floor map for Weasleys' Wizard Wheezes (data/cabinet-example/shop-floor-map/index.html). Parchment-and-ink aesthetic inspired by the Harry Potter Marauder's Map. Features: SVG floor plan with 6 zones (Candy Aisle, Prank Shelf, Laboratory, Storage, Checkout, Window Display) each with faint watercolor washes and ink-stroke details, 6 animated footstep dot pairs traversing a customer path via CSS offset-path, fade-in header with "I solemnly swear..." oath, slide-in parchment info panel with status dots/descriptions/metrics/restock flagging, toggle for customer flow visibility, legend with color swatches and status indicators, "Mischief Managed" double-click easter egg, full accessibility (ARIA roles, keyboard arrow navigation, focus states, prefers-reduced-motion). Single self-contained HTML file, embedded without .app marker so Cabinet sidebar stays visible.

[2026-04-06] Built the Weasleys' Wizard Wheezes public storefront (data/cabinet-example/storefront/source/index.html). "Magical Maximalism" e-commerce landing page with deep purple/orange/magenta palette, noise-texture overlay, gradient mesh backgrounds. Sections: sticky glass-blur nav with cart badge, full-viewport split hero with rotated image frame and trust badges, tilted infinite-scroll marquee strip, 2x2 product grid with accent-colored hover shadows and add-to-cart with bounce animation, diagonal-cut about section with stats grid, starfield testimonials (Luna/Neville/Lee Jordan), gradient CTA visit section, 3-column footer with U-No-Poo tagline. Functional slide-out cart drawer with quantity controls, focus trapping, and keyboard dismiss. IntersectionObserver scroll reveals, prefers-reduced-motion support, full ARIA labels, skip-to-content link, responsive down to mobile with hamburger overlay menu. Added .app marker for full-screen iframe mode.

[2026-04-07] Configured Electron macOS app identity and chrome. Added app icon (.icns from runcabinet.com), set name to "Cabinet", bundle ID to com.runcabinet.cabinet, copyright to "© 2026 Hila Shmuel", category to productivity. Switched to hiddenInset title bar with traffic light positioning. Added CSS drag region on header, sidebar-header left padding (80px) for traffic light clearance, and inline script to detect Electron runtime via window.CabinetDesktop class.

[2026-04-07] Fixed wiki-link navigation in the editor. Wiki-links (`[[Page Name]]` / `#page:slug`) were rendered but had no click handler, so clicking them did nothing. Added a click event listener in the KBEditor component that intercepts wiki-link clicks, resolves the slug to a tree path (preferring sibling pages under the same parent), expands parent directories in the sidebar, and navigates to the target page via selectPage + loadPage.

[2026-04-08] Retired the legacy standalone terminal server by turning `server/terminal-server.ts` into a compatibility shim that delegates to `cabinet-daemon.ts`. Rewrote `provider-runtime.test.ts` around ACP session behavior instead of the removed launch-spec API, fixed ACP-related type/test regressions, and verified the cleanup with `npx tsc --noEmit` and `npm test`.
