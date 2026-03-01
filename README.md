# MD Journal - VS Code Extension

This is a VS Code extension that leverages the built-in markdown editing capabilities of VS Code to provide a streamlined journaling experience. The extension automates the creation and organization of daily journal entries in markdown format.

## Features

*   **Automatic File Renaming:** When a new daily note is saved, it is automatically renamed based on the first line of the entry.
*   **"Go to Today's Note" Command:** A dedicated command to quickly open the current day's journal entry if it already exists.
*   **"Open Journal Folder" Command:** A simple command to open your main journal directory in the VS Code File Explorer as a VS Code menu side panel.
*   **Customizable Folder Structure:** Define your preferred folder hierarchy using `YYYY`, `MM`, and `DD` placeholders (e.g., `YYYY/MM/DD` or `YYYY-MM-DD`).
*   **Status Bar Indicator:** A status bar icon that shows whether you've created an entry for today.
*   **Tagging/Bookmarking System:** Supports `#tags` within markdown files and provides a dedicated view to browse tags and their associated entries.
*   **Template Management:** Create and use templates directly from your journal folder. Templates are stored in a `.templates` subfolder within your journal path.
*   **Backlinks/Wikilinks:** Supports `[[wiki-link]]` style linking between notes, with a dedicated sidebar view to show notes linking to the current file.

## Features & Command Reference

### Journal Entry Commands
- **Create Today’s Entry:**  
	Open the Command Palette (`Ctrl+Shift+P`), run `MD Journal: Create Today's Entry`.  
	- Creates a new entry for today using your configured template.
	- If the entry exists, opens it.

- **Open Journal Sidebar:**  
	Use `MD Journal: Show Sidebar` to view Entries, Tags, and Backlinks.

### Tags
- Add tags anywhere in your entry using `#tagname` (e.g., `#work`, `#idea`).
- Tags are automatically indexed and shown in the Tags sidebar.
- Click a tag in the sidebar to see all entries containing it.

### Backlinks (Wikilinks)
- Create links to other entries using `[[Entry Title]]`.
- Backlinks are indexed and shown in the Backlinks sidebar.
- Click a backlink to navigate to the referenced entry.

### Templates & Variables
- Templates are stored in the `.templates` folder in your journal path.
- When creating a new entry, the default template is used.
- Supported template variables:
	- `{date}`: Replaced with the entry’s date (e.g., `2025-08-09`).

### Settings
- **Journal Path:** Set the root folder for your journal.
- **Folder Structure:** Customize with placeholders (`YYYY`, `MM`, `DD`).
- **File Header Format:** Define the default header for new entries.
## Usage

On first run, the extension will prompt you to select a root directory for your journal.

You can create new daily entries or go to today's note using the commands in the VS Code Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):
*   `Journal: New Daily Entry` (If templates exist, you will be prompted to select one. Otherwise, a blank note with a timestamped header will be created.)
*   `Journal: Go to Today's Note`
*   `Journal: Save as Template` (Saves the content of the active editor as a template in your journal's `.templates` folder. The initial timestamp header will be automatically removed.)

## Configuration

*   `md-journal.journalPath`: The root path to your journal.
*   `md-journal.folderStructure`: The folder structure for your journal entries (e.g., `YYYY/MM/DD` or `YYYY-MM-DD`). Use `YYYY`, `MM`, `DD` as placeholders (default: `YYYY/MM/DD`).
*   `md-journal.fileHeaderFormat`: The format for the header of a new journal file. Uses `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss` as placeholders (default: `YYYY-MM-DD HH:mm:ss`).
