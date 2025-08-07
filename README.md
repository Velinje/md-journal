# MD Journal - VS Code Extension

This is a VS Code extension that leverages the built-in markdown editing capabilities of VS Code to provide a streamlined journaling experience. The extension automates the creation and organization of daily journal entries in markdown format.

## Features

*   **Automatic File Renaming:** When a new daily note is saved, it is automatically renamed based on the first line of the entry.
*   **"Go to Today's Note" Command:** A dedicated command to quickly open the current day's journal entry if it already exists.
*   **"Open Journal Folder" Command:** A simple command to open your main journal directory in the VS Code File Explorer as a VS Code menu side panel.
*   **Customizable Folder Structure:** Define your preferred folder hierarchy using `YYYY`, `MM`, and `DD` placeholders (e.g., `YYYY/MM/DD` or `YYYY-MM-DD`).

## Usage

On first run, the extension will prompt you to select a root directory for your journal and to configure the date format for daily folders (e.g., `YYYY-MM-DD`).

You can create new daily entries or go to today's note using the commands in the VS Code Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):
*   `Journal: New Daily Entry`
*   `Journal: Go to Today's Note`

## Configuration

*   `md-journal.journalPath`: The root path to your journal.
*   `md-journal.folderStructure`: The folder structure for your journal entries (e.g., `YYYY/MM/DD` or `YYYY-MM-DD`). Use `YYYY`, `MM`, `DD` as placeholders (default: `YYYY/MM/DD`).
*   `md-journal.fileHeaderFormat`: The format for the header of a new journal file. Uses `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss` as placeholders (default: `YYYY-MM-DD HH:mm:ss`).
