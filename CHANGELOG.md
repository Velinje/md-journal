# Changelog

All notable changes to the "md-journal" extension will be documented in this file.

## 0.6.2

### Hotfixes & Upgrades
- **Tree View Initialization**: Resolved path issue where the Journal Tree View would fail to load dynamic user configurations properly on boot, leading to false "empty journal" UI states. Tree providers now dynamically fetch current configuration bindings.
- **Node Engine Compatibility**: Added an explicit `engines.node >= 20.19.0` minimum restriction.

## 0.6.1

### Hotfixes & Optimizations
- **Dependency Integrations**: Upgraded core extension infrastructure testing packages and type definitions locally ensuring stable environment configurations securely.

## 0.6.0

### Features & Improvements
- **Guided First-Run Setup**: Context-aware welcome panels and unified command fallbacks securely guide you into configuring your root journal via native folder-picker directories without invoking silent failures internally.
- **Rename Protections & OS Isolation**: Safely intercepts collision strings ensuring manual/auto renames elegantly bounce rather than fatally crashing. Properly maps Linux/Mac/Windows case-sensitive filesystems independently intercepting trailing explicit `.md` strings securely. 
- **Scoped CPU Background Efficiencies**: Reduced global `**/*.md` memory hooks down dynamically scoping your mapped root path securely terminating un-configured idle extension CPU loads perfectly.
- **Safe Directory Migrations**: Implicated a fault-tolerant path migration map bouncing un-overwritten collision files cleanly tracking safe skip migrations accurately internally!
- **Index State Resiliency**: Mitigates overlapping race conditions queuing IDE watch events aggressively securing memory index cache trees flawlessly.


## 0.5.0

### Performance & Architecture Overhaul
- **Zero-Latency Indexing**: Migrated the internal index engine to use a persistent SQLite-backed Memento cache. The extension now performs differential updates—meaning it boots instantly and only reads files modified since your last session. 
- **Remote Workspace Capability**: Fully migrated the internal file-system engine off native Node `fs` bindings and onto asynchronous `vscode.workspace.fs` APIs. The extension is now 100% compatible with remote SSH, Codespaces, and WSL configurations.
- **Lazy-Loaded UI Rendering**: Significantly reduced the UI memory footprint by deferring markdown previews. Tree view hover tooltips are now constructed lazily only when you explicitly hover over a node.
- **Unresponsive Host Protections**: Rewrote recursive directory scanning and file-watch loops using strict 300ms debouncing and explicit macrotask chunking. Performing massive bulk rename operations or indexing 2,000+ files will no longer freeze the VS Code Extension Host.
- **Lightning-Fast Builds**: Replaced the legacy `esbuild` dependency with `rolldown` and `oxc-minify`, slashing the extension's bundled footprint down to ~37kB.

## 0.4.0

- **UX Enhancements**: Implemented intelligent auto-expansion of current Year and Month directory folders within the Journal and Tag tree views, saving you clicks when browsing recent entries.
- **Release Polish**: Finalized the `package.json` manifest attributes, gallery colors, and extension icon for broader marketplace compatibility.

## 0.2.0

- **Features:**
  - Implemented timestamp-based file headers for new journal entries, allowing multiple notes per day.
  - Added a status bar indicator to show whether today's journal entry exists.
  - Introduced a comprehensive template management system, allowing users to save current notes as templates and select templates when creating new entries. Templates are stored in a `.templates` subfolder within the journal path.
  - Developed a tagging and bookmarking system, enabling `#tags` within markdown files and providing a dedicated sidebar view to browse tags and their associated entries.
  - Implemented backlinks/wikilinks support, allowing `[[wiki-link]]` style linking between notes and displaying notes linking to the current file in a dedicated sidebar view.
- **Branding & Polish:**
  - Refined extension `displayName` and `description` for clarity and market appeal.
  - Added custom icons for sidebar views (Entries, Tags, Backlinks) and the main activity bar icon for enhanced visual branding.
- **Improvements:**
  - Enhanced initial setup experience for journal path configuration.
  - Improved file system watching for real-time updates to tag and link indexes.

## 0.1.0

- Implemented yearly and daily folder structure for notes (`YYYY/MM-DD`).
- Updated Journal Tree View to correctly display notes within the new `YYYY/MM-DD` folder structure.
- Moved development context to `DEVELOPMENT_NOTES.md`.
- Refactored `README.md` to provide clear user-facing information, including features, usage, and configuration.
- Added MIT License.
- Updated project dependencies.
