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

        const folderStructure = vscode.workspace.getConfiguration('md-journal').get<string>('folderStructure', 'YYYY/MM-DD');
        const components = folderStructure.split(/[\\/>]/);

        if (element) {
            // If element is a folder, get its children
            if (element.contextValue === 'folder') {
                const currentPath = (element as FolderTreeItem).fullPath;
                const currentLevel = (element as FolderTreeItem).level;

                const children = fs.readdirSync(currentPath).filter(file => {
                    const fullPath = path.join(currentPath, file);
                    const isDirectory = fs.statSync(fullPath).isDirectory();
                    const isMarkdownFile = file.endsWith('.md');

                    if (isDirectory) {
                        const nextLevelComponent = components[currentLevel];
                        return this.matchesComponentPattern(file, nextLevelComponent);
                    }
                    return isMarkdownFile;
                });

                return Promise.resolve(
                    children.map(child => {
                        const childPath = path.join(currentPath, child);
                        if (fs.statSync(childPath).isDirectory()) {
                            return new FolderTreeItem(child, vscode.TreeItemCollapsibleState.Collapsed, childPath, currentLevel + 1);
                        } else {
                            const treeItem = new vscode.TreeItem(child, vscode.TreeItemCollapsibleState.None);
                            treeItem.command = {
                                command: 'vscode.open',
                                title: 'Open File',
                                arguments: [vscode.Uri.file(childPath)]
                            };
                            return treeItem;
                        }
                    })
                );
            }
            return Promise.resolve([]); // Should not happen for files
        } else {
            // This is the root, so we are getting the first level of folders based on the structure
            const rootPath = this.journalPath;
            const firstLevelComponent = components[0];

            const firstLevelFolders = fs.readdirSync(rootPath).filter(file => {
                const fullPath = path.join(rootPath, file);
                return fs.statSync(fullPath).isDirectory() && this.matchesComponentPattern(file, firstLevelComponent);
            });

            return Promise.resolve(
                firstLevelFolders.map(folder => new FolderTreeItem(folder, vscode.TreeItemCollapsibleState.Collapsed, path.join(rootPath, folder), 1))
            );
        }
    }

    updateJournalPath(journalPath: string): void {
        this.journalPath = journalPath;
        this.refresh();
    }

    private matchesComponentPattern(name: string, component: string): boolean {
        switch (component) {
            case 'YYYY':
                return /^\d{4}$/.test(name);
            case 'MM':
                return /^\d{2}$/.test(name) && parseInt(name) >= 1 && parseInt(name) <= 12;
            case 'DD':
                return /^\d{2}$/.test(name) && parseInt(name) >= 1 && parseInt(name) <= 31;
            default:
                return true; // For custom components, assume it matches for now
        }
    }
}

class FolderTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly fullPath: string,
        public readonly level: number
    ) {
        super(label, collapsibleState);
        this.contextValue = 'folder';
    }
}
