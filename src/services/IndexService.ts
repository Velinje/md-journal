import * as vscode from 'vscode';
import * as path from 'path';
import { getAllMarkdownFiles } from '../filesystem';
import { getJournalPath } from '../settings';

interface TagIndex { [tag: string]: string[]; }
interface LinkIndex {
    [filePath: string]: {
        linksTo: string[];
        linkedFrom: string[];
    };
}

export class IndexService {
    private tagIndex: TagIndex = {};
    private linkIndex: LinkIndex = {};

    private fileToTags: { [filePath: string]: string[] } = {};

    private journalPath: string;

    private cachedMdFiles: { [title: string]: string } | null = null;

    private context?: vscode.ExtensionContext;

    public isInitializing: boolean = false;

    private _onIndexUpdated = new vscode.EventEmitter<void>();
    public readonly onIndexUpdated = this._onIndexUpdated.event;

    constructor(journalPath: string, context?: vscode.ExtensionContext) {
        this.journalPath = journalPath;
        this.context = context;
    }

    public getTags(): string[] {
        return Object.keys(this.tagIndex).sort();
    }

    public getFilesForTag(tag: string): string[] {
        return this.tagIndex[tag] || [];
    }

    public getBacklinks(filePath: string): string[] {
        return this.linkIndex[filePath]?.linkedFrom || [];
    }

    public async setJournalPath(newPath: string) {
        this.journalPath = newPath;
        await this.initializeIndex();
    }

    public async initializeIndex() {
        if (!this.journalPath) { return; }
        if (this.isInitializing) { return; }

        this.isInitializing = true;
        try {
            let lastSessionTime = 0;
            if (this.context) {
                const cachedData = this.context.workspaceState.get<{
                    tagIndex: TagIndex,
                    linkIndex: LinkIndex,
                    fileToTags: { [filePath: string]: string[] },
                    lastSessionTime: number
                }>('mdJournal.indexCache');

                if (cachedData) {
                    this.tagIndex = cachedData.tagIndex || {};
                    this.linkIndex = cachedData.linkIndex || {};
                    this.fileToTags = cachedData.fileToTags || {};
                    lastSessionTime = cachedData.lastSessionTime || 0;
                } else {
                    this.tagIndex = {};
                    this.linkIndex = {};
                    this.fileToTags = {};
                }
            } else {
                this.tagIndex = {};
                this.linkIndex = {};
                this.fileToTags = {};
            }

            const files = await getAllMarkdownFiles(this.journalPath);

            this.cachedMdFiles = {};
            for (const file of files) {
                const normalizedTitle = path.basename(file, '.md').replace(/-/g, ' ');
                this.cachedMdFiles[normalizedTitle] = file;
            }

            const currentSessionTime = Date.now();
            const currentFiles = new Set(files);
            let hasUpdates = false;

            const indexedFiles = Object.keys(this.linkIndex);
            for (const indexedFile of indexedFiles) {
                if (!currentFiles.has(indexedFile)) {
                    await this.updateIndexForFile(indexedFile, false, true, true, true);
                    hasUpdates = true;
                }
            }

            const CHUNK_SIZE = 50;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(file));
                    if (stat.mtime > lastSessionTime || !this.linkIndex[file]) {
                        await this.updateIndexForFile(file, false, true, false, true);
                        hasUpdates = true;
                    }
                } catch (e) {
                    console.error(`Error stat ${file}`, e);
                }

                if (i % CHUNK_SIZE === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            if (this.context && (hasUpdates || lastSessionTime === 0)) {
                await this.saveCache(currentSessionTime);
            }

            this._onIndexUpdated.fire();
        } finally {
            this.isInitializing = false;
        }
    }

    private async saveCache(sessionTime: number = Date.now()) {
        if (this.context) {
            await this.context.workspaceState.update('mdJournal.indexCache', {
                tagIndex: this.tagIndex,
                linkIndex: this.linkIndex,
                fileToTags: this.fileToTags,
                lastSessionTime: sessionTime
            });
        }
    }

    public async triggerSaveAndFire() {
        await this.saveCache();
        this._onIndexUpdated.fire();
    }

    public async updateIndexForFile(filePath: string, fireEvent: boolean = true, skipExistsCheck: boolean = false, forceDelete: boolean = false, bypassInitCheck: boolean = false) {
        if (this.isInitializing && !bypassInitCheck) {
            return;
        }

        const previousTags = this.fileToTags[filePath] || [];
        for (const tag of previousTags) {
            if (this.tagIndex[tag]) {
                this.tagIndex[tag] = this.tagIndex[tag].filter(p => p !== filePath);
                if (this.tagIndex[tag].length === 0) {
                    delete this.tagIndex[tag];
                }
            }
        }
        delete this.fileToTags[filePath];

        const oldLinks = this.linkIndex[filePath]?.linksTo || [];
        for (const linkedToFile of oldLinks) {
            if (this.linkIndex[linkedToFile]) {
                this.linkIndex[linkedToFile].linkedFrom = this.linkIndex[linkedToFile].linkedFrom.filter(p => p !== filePath);
            }
        }

        let fileExists = true;
        if (forceDelete) {
            fileExists = false;
        } else if (!skipExistsCheck) {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            } catch {
                fileExists = false;
            }
        }

        if (!fileExists) {
            delete this.linkIndex[filePath];
            if (fireEvent) {
                await this.saveCache();
                this._onIndexUpdated.fire();
            }
            return;
        }

        this.linkIndex[filePath] = { linksTo: [], linkedFrom: this.linkIndex[filePath]?.linkedFrom || [] };

        const contentUint8Array = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
        const content = new TextDecoder('utf8').decode(contentUint8Array);

        const tags = Array.from(new Set(this.extractTags(content)));

        this.fileToTags[filePath] = tags;

        for (const tag of tags) {
            if (!this.tagIndex[tag]) {
                this.tagIndex[tag] = [];
            }
            if (!this.tagIndex[tag].includes(filePath)) {
                this.tagIndex[tag].push(filePath);
            }
        }

        const links = this.extractWikilinks(content);
        for (const linkTitle of links) {
            let targetPath = this.resolveLinkPath(filePath, linkTitle);
            if (!targetPath) {
                const journalRoot = getJournalPath() || this.journalPath;
                targetPath = path.join(journalRoot, `${linkTitle}.md`);
            }
            if (!this.linkIndex[filePath].linksTo.includes(targetPath)) {
                this.linkIndex[filePath].linksTo.push(targetPath);
            }
            if (!this.linkIndex[targetPath]) {
                this.linkIndex[targetPath] = { linksTo: [], linkedFrom: [] };
            }
            if (!this.linkIndex[targetPath].linkedFrom.includes(filePath)) {
                this.linkIndex[targetPath].linkedFrom.push(filePath);
            }
        }

        if (fireEvent) {
            await this.saveCache();
            this._onIndexUpdated.fire();
        }
    }

    private extractTags(content: string): string[] {
        const tagRegex = /(?:^|\s)#[a-zA-Z0-9_\-]+/g;
        const matches = content.match(tagRegex);
        if (matches) {
            return matches.map(match => match.trim().substring(1));
        }
        return [];
    }

    private extractWikilinks(content: string): string[] {
        const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
        const matches = [...content.matchAll(wikilinkRegex)];
        return matches.map(match => match[1]);
    }

    private resolveLinkPath(sourceFilePath: string, linkTitle: string): string | undefined {
        const journalRoot = getJournalPath() || this.journalPath;
        if (!journalRoot) {
            return undefined;
        }

        if (!this.cachedMdFiles) {
            return;
        }

        const searchTitle = linkTitle.replace(/-/g, ' ');

        return this.cachedMdFiles[searchTitle];
    }
}
