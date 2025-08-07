# MD Journal - VS Code Extension

This is a VS Code extension that leverages the built-in markdown editing capabilities of VS Code to provide a streamlined journaling experience. The extension automates the creation and organization of daily journal entries in markdown format.

## Features

*   **Automatic File Renaming:** When a new daily note is saved, it is automatically renamed based on the first line of the entry.
*   **"Go to Today's Note" Command:** A dedicated command to quickly open the current day's journal entry if it already exists.
*   **"Open Journal Folder" Command:** A simple command to open your main journal directory in the VS Code File Explorer as a VS Code menu side panel.
*   **Yearly and Daily Folder Structure:** Notes are organized into `YYYY/MM-DD` folders for better organization.

## Usage

On first run, the extension will prompt you to select a root directory for your journal and to configure the date format for daily folders (e.g., `YYYY-MM-DD`).

You can create new daily entries or go to today's note using the commands in the VS Code Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):
*   `Journal: New Daily Entry`
*   `Journal: Go to Today's Note`

## Configuration

*   `md-journal.journalPath`: The root path to your journal.
*   `md-journal.dateFormat`: The date format for your daily journal folders (default: `YYYY-MM-DD`).
