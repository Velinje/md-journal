import * as vscode from 'vscode';
import { TagIndexManager } from './TagIndexManager';
import * as path from 'path';
import { getDateFromPath } from './date';
import { getFolderStructure, getJournalPath } from './settings';

export class TagTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'year' | 'tag' | 'file',
        public readonly year?: string,
        public readonly tag?: string,
        public readonly fileUri?: vscode.Uri
    ) {
        super(label, collapsibleState);
        this.contextValue = type;
        if (fileUri) {
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [fileUri]
            };
        }
    }
}

export class TagTreeViewProvider implements vscode.TreeDataProvider<TagTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TagTreeItem | undefined | void> = new vscode.EventEmitter<TagTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TagTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    private tagIndexManager: TagIndexManager;

    constructor(tagIndexManager: TagIndexManager) {
        this.tagIndexManager = tagIndexManager;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TagTreeItem): vscode.TreeItem {
        return element;
    }

    private getFileYear(file: string, folderStructure: string, journalPath: string): string {
        const date = getDateFromPath(file, folderStructure, journalPath);
        return date ? date.getFullYear().toString() : 'Unknown';
    }

    async getChildren(element?: TagTreeItem): Promise<TagTreeItem[]> {
        const folderStructure = getFolderStructure();
        const journalPath = getJournalPath();

        if (element) {
            if (element.type === 'year') {
                // Show tags for this year
                const allTags = this.tagIndexManager.getTags();
                const tagsInYear: string[] = [];

                for (const tag of allTags) {
                    const files = this.tagIndexManager.getFilesForTag(tag);
                    const filesInYear = files.filter(f => this.getFileYear(f, folderStructure, journalPath) === element.year);
                    if (filesInYear.length > 0) {
                        tagsInYear.push(tag);
                    }
                }

                return tagsInYear.map(tag => new TagTreeItem(tag, vscode.TreeItemCollapsibleState.Collapsed, 'tag', element.year, tag));
            } else if (element.type === 'tag') {
                // Show files for this tag and year
                const files = this.tagIndexManager.getFilesForTag(element.tag!).filter(f => this.getFileYear(f, folderStructure, journalPath) === element.year);
                return files.map(file => new TagTreeItem(path.basename(file), vscode.TreeItemCollapsibleState.None, 'file', element.year, element.tag, vscode.Uri.file(file)));
            }
            return [];
        } else {
            // Root level: Show all years
            const tags = this.tagIndexManager.getTags();
            const years = new Set<string>();

            for (const tag of tags) {
                const files = this.tagIndexManager.getFilesForTag(tag);
                for (const file of files) {
                    years.add(this.getFileYear(file, folderStructure, journalPath));
                }
            }

            const currentYearStr = new Date().getFullYear().toString();
            return Array.from(years).sort((a, b) => b.localeCompare(a)).map(year => {
                const isCurrentYear = year === currentYearStr;
                return new TagTreeItem(year, isCurrentYear ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'year', year);
            });
        }
    }
}
