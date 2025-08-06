# MD Journal - VS Code Extension

## Project Overview (for AI Context)

This is a VS Code extension that leverages the built-in markdown editing capabilities of VS Code to provide a streamlined journaling experience. The extension automates the creation and organization of daily journal entries in markdown format.

On first run, the extension will prompt the user to select a root directory for their journal and to configure the date format for daily folders (e.g., `YYYY-MM-DD`).

The core functionality is exposed through a command in the Command Palette, allowing for quick creation of new entries regardless of the currently open workspace. This ensures the journal is always accessible.

If a journal entry is created without a title, the extension will automatically use a snippet from the first line as the filename.

The core goal is to create a small, robust, and fast journaling tool for developers and writers who prefer to work within VS Code and use markdown.

## Core Functionality Decisions

*   **Storage Location:** The user is prompted to select a root directory for the journal on the first run. This setting is stored for subsequent uses.
*   **Activation:** The primary way to create a new entry is through a command in the Command Palette (e.g., `Journal: New Daily Entry`).
*   **Folder Structure:** Daily entries are stored in sub-folders. The folder name format is configurable by the user on first run (defaulting to `YYYY-MM-DD`).
*   **Workspace Independence:** The extension is designed to work without a specific workspace being open, allowing global access to the journal.
*   **Initial Search:** For the initial version, users can leverage VS Code's built-in file search by opening the main journal folder. Advanced search is a potential future feature.

## Added features
*   **Automatic File Renaming:** When a new daily note is saved, it is automatically renamed based on the first line of the entry.
*   **"Go to Today's Note" Command:** A dedicated command to quickly open the current day's journal entry if it already exists.
*   **"Open Journal Folder" Command:** A simple command to open your main journal directory in the VS Code File Explorer as a vs code menu side panel.

## Future Feature Ideas (To Be Explored)

*   **Status Bar Indicator:** A small icon or text in the status bar that shows whether you've created an entry for today. Clicking it could run the "Go to Today's Note" or "New Daily Entry" command.
*   **Backlinks/Wikilinks:** Support for `[[wiki-link]]` style linking between notes.
*   **Tagging/Bookmarking System:** Add support for `#tags` or similar metadata within markdown files to easily categorize and find entries.
*   **Journal Templates:** Allow users to define templates for different types of entries (e.g., daily stand-up, personal thoughts, meeting notes).
*   **Advanced Search:** Implement a dedicated command to search across all journal entries, potentially with filtering by date or tags.
*   **Calendar View:** A webview-based calendar to visualize and navigate to entries from different dates.
*   **Statistics:** Show word count, entry streak, and other interesting stats.
*   **Export Options:** Allow users to export their journal (or parts of it) to formats like PDF or HTML.

## Working with this Extension (Development)

This section contains the original boilerplate for extension development.

