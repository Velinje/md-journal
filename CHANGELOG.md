# Change Log

All notable changes to the "md-journal" extension will be documented in this file.

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
