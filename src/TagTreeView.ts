import * as vscode from 'vscode';
import { IndexService } from './services/IndexService';
import * as path from 'path';
import { getDateFromPath } from './date';
import { getFolderStructure, getJournalPath } from './settings';
import * as fs from 'fs';

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

    private indexService: IndexService;

    constructor(indexService: IndexService) {
        this.indexService = indexService;
        this.indexService.onIndexUpdated(() => this.refresh());
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
                const allTags = this.indexService.getTags();
                const tagsInYear: string[] = [];

                for (const tag of allTags) {
                    const files = this.indexService.getFilesForTag(tag);
                    const filesInYear = files.filter(f => this.getFileYear(f, folderStructure, journalPath) === element.year);
                    if (filesInYear.length > 0) {
                        tagsInYear.push(tag);
                    }
                }

                return tagsInYear.map(tag => new TagTreeItem(tag, vscode.TreeItemCollapsibleState.Collapsed, 'tag', element.year, tag));
            } else if (element.type === 'tag') {
                const files = this.indexService.getFilesForTag(element.tag!).filter(f => this.getFileYear(f, folderStructure, journalPath) === element.year);
                return files.map(file => new TagTreeItem(path.basename(file), vscode.TreeItemCollapsibleState.None, 'file', element.year, element.tag, vscode.Uri.file(file)));
            }
            return [];
        } else {
            const tags = this.indexService.getTags();
            const years = new Set<string>();

            for (const tag of tags) {
                const files = this.indexService.getFilesForTag(tag);
                for (const file of files) {
                    years.add(this.getFileYear(file, folderStructure, journalPath));
                }
            }

            const currentYearStr = new Date().getFullYear().toString();
            return Array.from(years).sort((a, b) => b.localeCompare(a)).map(year => {
                const isCurrentOrPrevYear = year === currentYearStr || year === (new Date().getFullYear() - 1).toString();
                return new TagTreeItem(year, isCurrentOrPrevYear ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'year', year);
            });
        }
    }

    async resolveTreeItem(item: TagTreeItem, element: TagTreeItem, token: vscode.CancellationToken): Promise<TagTreeItem> {
        if (element.type === 'file' && element.fileUri && element.fileUri.scheme === 'file') {
            try {
                const content = await fs.promises.readFile(element.fileUri.fsPath, 'utf8');
                const preview = content.split('\n').slice(0, 10).join('\n').trim();
                const mdTooltip = new vscode.MarkdownString();
                mdTooltip.appendMarkdown(`**${path.basename(element.fileUri.fsPath)}**\n\n---\n\n`);
                mdTooltip.appendCodeblock(preview, 'markdown');
                element.tooltip = mdTooltip;
            } catch (error) {
                element.tooltip = element.fileUri?.fsPath;
            }
        }
        return element;
    }
}
