# Development Notes

This document contains notes and context related to the development of the MD Journal VS Code Extension.

## Project Overview

This is a VS Code extension that leverages the built-in markdown editing capabilities of VS Code to provide a streamlined journaling experience. The extension automates the creation and organization of daily journal entries in markdown format.

On first run, the extension will prompt the user to select a root directory for their journal and to configure the date format for daily folders (e.g., `YYYY-MM-DD`).

The core functionality is exposed through a command in the Command Palette, allowing for quick creation of new entries regardless of the currently open workspace. This ensures the journal is always accessible.

If a journal entry is created without a title, the extension will automatically use a snippet from the first line as the filename.

The core goal is to create a small, robust, super performant and fast journaling tool for developers and writers who prefer to work within VS Code and use markdown. Keeping it simple for a soul purpose of allowing it to work as a frictionless flow together with VS Code and it's extensability. It does not extend outside of those functional purposes as other functionalities are left for other extensions or programs to handle.

## Core Functionality Decisions

*   **Storage Location:** The user is prompted to select a root directory for the journal on the first run. This setting is stored for subsequent uses.
*   **Activation:** The primary way to create a new entry is through a command in the Command Palette (e.g., `Journal: New Daily Entry`).
*   **Folder Structure:** Daily entries are now stored in a customizable sub-folder structure defined by the `md-journal.folderStructure` setting (e.g., `YYYY/MM/DD`). This allows users to define their preferred hierarchy using `YYYY`, `MM`, and `DD` placeholders.
*   **Status Bar Indicator:** A small icon or text in the status bar that shows whether you've created an entry for today. Clicking it could run the "Go to Today's Note" or "New Daily Entry" command.
*   **Tagging/Bookmarking System:** Add support for `#tags` or similar metadata within markdown files to easily categorize and find entries. Add the possibility to have a bookmark section in the markdown explorer view.
*   **Journal Templates:** Allow users to create and manage templates directly within the journal folder. Templates are stored in a `.templates` subfolder and can be selected when creating new entries.
*   **Backlinks/Wikilinks:** Support for `[[wiki-link]]` style linking between notes, with a dedicated sidebar view to show notes linking to the current file.
*   **Workspace Independence:** The extension is designed to work without a specific workspace being open, allowing global access to the journal.
*   **Initial Search:** For the initial version, users can leverage VS Code's built-in file search by opening the main journal folder. Advanced search is a potential future feature.

## Future Feature Ideas

*   **Multiple Journals:** Allow users to create and manage multiple journals, each with its own settings and templates. Allow quick switch between journals.
*   **Advanced Search:** Implement a dedicated command to search across all journal entries, potentially with filtering by date or tags.
*   **Calendar View:** A webview-based calendar to visualize and navigate to entries from different dates.
*   **Statistics:** Show word count, entry streak, and other interesting stats. Historical footprints on your writing.
*   **Export Options:** Allow users to export their journal (or parts of it) to formats like PDF or HTML, CSV etc.
*   **General TODO file:** A markdown list of todos that can easily be accessible and edited with a quick keystroke