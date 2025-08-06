import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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
            // This is a date folder, so we are getting the files
            const date = element.label as string;
            const files = fs.readdirSync(path.join(this.journalPath, date));
            return Promise.resolve(
                files.map(file => {
                    const treeItem = new vscode.TreeItem(file, vscode.TreeItemCollapsibleState.None);
                    treeItem.command = {
                        command: 'vscode.open',
                        title: 'Open File',
                        arguments: [vscode.Uri.file(path.join(this.journalPath as string, date, file))]
                    };
                    return treeItem;
                })
            );
        } else {
            // This is the root, so we are getting the date folders
            const dirs = fs.readdirSync(this.journalPath).filter(file => {
                return fs.statSync(path.join(this.journalPath as string, file)).isDirectory();
            });
            return Promise.resolve(
                dirs.map(dir => new vscode.TreeItem(dir, vscode.TreeItemCollapsibleState.Collapsed))
            );
        }
    }

    updateJournalPath(journalPath: string): void {
        this.journalPath = journalPath;
        this.refresh();
    }
}
