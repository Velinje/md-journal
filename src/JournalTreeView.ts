import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class YearTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly year: string
    ) {
        super(label, collapsibleState);
        this.contextValue = 'year';
    }
}

class DateTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly year: string,
        public readonly date: string
    ) {
        super(label, collapsibleState);
        this.contextValue = 'date';
    }
}

export class JournalTreeViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private journalPath: string | undefined) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!this.journalPath) {
            const messageItem = new vscode.TreeItem('Journal path not set.', vscode.TreeItemCollapsibleState.None);
            messageItem.command = {
                command: 'md-journal.newDailyEntry',
                title: 'Set Journal Path'
            };
            return Promise.resolve([messageItem]);
        }

        if (element) {
            if (element.contextValue === 'year') {
                const year = (element as YearTreeItem).year;
                const yearPath = path.join(this.journalPath as string, year);
                const dateDirs = fs.readdirSync(yearPath).filter(file => {
                    return fs.statSync(path.join(yearPath, file)).isDirectory();
                });
                return Promise.resolve(
                    dateDirs.map(dir => new DateTreeItem(dir, vscode.TreeItemCollapsibleState.Collapsed, year, dir))
                );
            } else if (element.contextValue === 'date') {
                const year = (element as DateTreeItem).year;
                const date = (element as DateTreeItem).date;
                const datePath = path.join(this.journalPath as string, year, date);
                const files = fs.readdirSync(datePath).filter(file => file.endsWith('.md'));
                return Promise.resolve(
                    files.map(file => {
                        const treeItem = new vscode.TreeItem(file, vscode.TreeItemCollapsibleState.None);
                        treeItem.command = {
                            command: 'vscode.open',
                            title: 'Open File',
                            arguments: [vscode.Uri.file(path.join(datePath, file))]
                        };
                        return treeItem;
                    })
                );
            }
            return Promise.resolve([]); // Should not happen
        } else {
            // This is the root, so we are getting the year folders
            const years = fs.readdirSync(this.journalPath).filter(file => {
                const fullPath = path.join(this.journalPath as string, file);
                return fs.statSync(fullPath).isDirectory() && /^\d{4}$/.test(file); // Check if it's a 4-digit year
            });
            return Promise.resolve(
                years.map(year => new YearTreeItem(year, vscode.TreeItemCollapsibleState.Collapsed, year))
            );
        }
    }

    updateJournalPath(journalPath: string): void {
        this.journalPath = journalPath;
        this.refresh();
    }
}
