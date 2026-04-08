import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getDateFromPath } from './date';
import { getFolderStructure, getJournalPath } from './settings';
import { IndexService } from './services/IndexService';

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

    private indexService: IndexService;

    constructor(
        private journalPath: string | undefined,
        indexService: IndexService
    ) {
        this.indexService = indexService;
        this.indexService.onIndexUpdated(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!this.journalPath) {
            return [];
        }

        const folderStructure = getFolderStructure();
        const components = folderStructure.split(/[\/]/);

        if (element) {
            if (element.contextValue === 'folder') {
                const currentPath = (element as FolderTreeItem).fullPath;
                const currentLevel = (element as FolderTreeItem).level;

                const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
                const filteredEntries = entries.filter(entry => {
                    const file = entry.name;
                    const isDirectory = entry.isDirectory();
                    const isMarkdownFile = file.endsWith('.md');

                    if (isDirectory) {
                        if (file === '.templates') {
                            return false;
                        }
                        const nextLevelComponent = components[currentLevel];
                        return this.matchesComponentPattern(file, nextLevelComponent);
                    }
                    return isMarkdownFile;
                });

                filteredEntries.sort((a, b) => {
                    const aIsDir = a.isDirectory();
                    const bIsDir = b.isDirectory();

                    if (aIsDir && bIsDir) {
                        const aPath = path.join(currentPath, a.name);
                        const bPath = path.join(currentPath, b.name);
                        const aDate = getDateFromPath(aPath, folderStructure, this.journalPath || '');
                        const bDate = getDateFromPath(bPath, folderStructure, this.journalPath || '');
                        if (aDate && bDate) {
                            return bDate.getTime() - aDate.getTime();
                        }
                    }
                    return b.name.localeCompare(a.name);
                });

                return filteredEntries.map(entry => {
                    const childPath = path.join(currentPath, entry.name);
                    if (entry.isDirectory()) {
                        const state = this.getCollapsibleState(childPath, folderStructure);
                        return new FolderTreeItem(entry.name, state, childPath, currentLevel + 1);
                    } else {
                        const treeItem = new vscode.TreeItem(entry.name, vscode.TreeItemCollapsibleState.None);
                        treeItem.contextValue = 'file';
                        treeItem.resourceUri = vscode.Uri.file(childPath);
                        treeItem.command = {
                            command: 'vscode.open',
                            title: 'Open File',
                            arguments: [vscode.Uri.file(childPath)]
                        };
                        return treeItem;
                    }
                });
            }
            return [];
        } else {
            const rootPath = this.journalPath;
            const firstLevelComponent = components[0];

            let entries: fs.Dirent[] = [];
            try {
                entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
            } catch (err) {
                return [];
            }

            const firstLevelFolders = entries.filter(entry => {
                if (entry.name === '.templates') {
                    return false;
                }
                return entry.isDirectory() && this.matchesComponentPattern(entry.name, firstLevelComponent);
            }).sort((a, b) => {
                const aPath = path.join(rootPath, a.name);
                const bPath = path.join(rootPath, b.name);
                const aDate = getDateFromPath(aPath, folderStructure, this.journalPath || '');
                const bDate = getDateFromPath(bPath, folderStructure, this.journalPath || '');
                if (aDate && bDate) {
                    return bDate.getTime() - aDate.getTime();
                }
                return b.name.localeCompare(a.name);
            });

            return firstLevelFolders.map(entry => {
                const childPath = path.join(rootPath, entry.name);
                const state = this.getCollapsibleState(childPath, folderStructure);
                return new FolderTreeItem(entry.name, state, childPath, 1);
            });
        }
    }

    private getCollapsibleState(folderPath: string, folderStructure: string): vscode.TreeItemCollapsibleState {
        const date = getDateFromPath(folderPath, folderStructure, this.journalPath || '');
        if (!date) {
            return vscode.TreeItemCollapsibleState.Collapsed;
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const folderYear = date.getFullYear();
        const folderMonth = date.getMonth();

        const relativePath = path.relative(this.journalPath || '', folderPath);
        const pathParts = relativePath.split(path.sep);
        const structureParts = folderStructure.split(/[\/\\]/);
        const currentLevelIndex = pathParts.length - 1;

        if (currentLevelIndex >= 0 && currentLevelIndex < structureParts.length) {
            const currentStructurePart = structureParts[currentLevelIndex];
            const definesMonth = currentStructurePart.includes('MM') || currentStructurePart.includes('MMMM');
            const definesYear = currentStructurePart.includes('YYYY');

            if (definesYear && !definesMonth) {
                if (folderYear === currentYear || folderYear === currentYear - 1) {
                    return vscode.TreeItemCollapsibleState.Expanded;
                }
            } else if (definesMonth) {
                if (folderYear === currentYear && folderMonth === currentMonth) {
                    return vscode.TreeItemCollapsibleState.Expanded;
                }
            }
        }

        return vscode.TreeItemCollapsibleState.Collapsed;
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

    async resolveTreeItem(item: vscode.TreeItem, element: vscode.TreeItem, token: vscode.CancellationToken): Promise<vscode.TreeItem> {
        if (element.contextValue === 'file' && element.resourceUri && element.resourceUri.scheme === 'file') {
            try {
                const content = await fs.promises.readFile(element.resourceUri.fsPath, 'utf8');
                const preview = content.split('\n').slice(0, 10).join('\n').trim();
                const mdTooltip = new vscode.MarkdownString();
                mdTooltip.appendMarkdown(`**${path.basename(element.resourceUri.fsPath)}**\n\n---\n\n`);
                mdTooltip.appendCodeblock(preview, 'markdown');
                element.tooltip = mdTooltip;
            } catch (error) {
                element.tooltip = element.resourceUri?.fsPath;
            }
        }
        return element;
    }
}