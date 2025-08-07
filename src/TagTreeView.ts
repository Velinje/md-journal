import * as vscode from 'vscode';
import { TagIndexManager } from './TagIndexManager';
import * as path from 'path';

export class TagTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
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

    async getChildren(element?: TagTreeItem): Promise<TagTreeItem[]> {
        if (element) {
            // If element is a tag, show files for that tag
            const files = this.tagIndexManager.getFilesForTag(element.label);
            return files.map(file => new TagTreeItem(path.basename(file), vscode.TreeItemCollapsibleState.None, {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(file)]
            }));
        } else {
            // Show all tags
            const tags = this.tagIndexManager.getTags();
            return tags.map(tag => new TagTreeItem(tag, vscode.TreeItemCollapsibleState.Collapsed));
        }
    }
}
