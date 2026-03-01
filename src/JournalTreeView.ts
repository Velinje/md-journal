import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getDateFromPath } from './date';
import { getFolderStructure, getJournalPath } from './settings';

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

export class JournalTreeViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private journalPath: string | undefined) { }

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

        const folderStructure = getFolderStructure();
        const components = folderStructure.split(/[\/]/);

        if (element) {
            if (element.contextValue === 'folder') {
                const currentPath = (element as FolderTreeItem).fullPath;
                const currentLevel = (element as FolderTreeItem).level;

                const children = fs.readdirSync(currentPath).filter(file => {
                    const fullPath = path.join(currentPath, file);
                    const isDirectory = fs.statSync(fullPath).isDirectory();
                    const isMarkdownFile = file.endsWith('.md');

                    if (isDirectory) {
                        if (file === '.templates') {
                            return false;
                        }
                        const nextLevelComponent = components[currentLevel];
                        return this.matchesComponentPattern(file, nextLevelComponent);
                    }
                    return isMarkdownFile;
                }).sort((a, b) => {
                    const aPath = path.join(currentPath, a);
                    const bPath = path.join(currentPath, b);
                    const aIsDir = fs.statSync(aPath).isDirectory();
                    const bIsDir = fs.statSync(bPath).isDirectory();

                    if (aIsDir && bIsDir) {
                        const aDate = getDateFromPath(aPath, folderStructure, this.journalPath || '');
                        const bDate = getDateFromPath(bPath, folderStructure, this.journalPath || '');
                        if (aDate && bDate) {
                            return bDate.getTime() - aDate.getTime();
                        }
                    }
                    return b.localeCompare(a);
                });

                return Promise.resolve(
                    children.map(child => {
                        const childPath = path.join(currentPath, child);
                        if (fs.statSync(childPath).isDirectory()) {
                            return new FolderTreeItem(child, vscode.TreeItemCollapsibleState.Collapsed, childPath, currentLevel + 1);
                        }
                        else {
                            const treeItem = new vscode.TreeItem(child, vscode.TreeItemCollapsibleState.None);
                            treeItem.contextValue = 'file';
                            treeItem.resourceUri = vscode.Uri.file(childPath);
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
            return Promise.resolve([]);
        }
        else {
            const rootPath = this.journalPath;
            const firstLevelComponent = components[0];

            const firstLevelFolders = fs.readdirSync(rootPath).filter(file => {
                if (file === '.templates') {
                    return false;
                }
                const fullPath = path.join(rootPath, file);
                return fs.statSync(fullPath).isDirectory() && this.matchesComponentPattern(file, firstLevelComponent);
            }).sort((a, b) => {
                const aDate = getDateFromPath(path.join(rootPath, a), folderStructure, this.journalPath || '');
                const bDate = getDateFromPath(path.join(rootPath, b), folderStructure, this.journalPath || '');
                if (aDate && bDate) {
                    return bDate.getTime() - aDate.getTime();
                }
                return b.localeCompare(a);
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
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        let regexString = component
            .replace('YYYY', '\\d{4}')
            .replace('MMMM', `(${monthNames.join('|')})`)
            .replace('MM', '\\d{2}')
            .replace('dddd', `(${dayNames.join('|')})`)
            .replace('DD', '\\d{2}');

        regexString = `^${regexString}$`;

        const regex = new RegExp(regexString);
        return regex.test(name);
    }

}