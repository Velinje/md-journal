import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getAllMarkdownFiles, getAllMarkdownFilesSync } from '../filesystem';
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

    // Map of filePath -> list of tags this file contains
    private fileToTags: { [filePath: string]: string[] } = {};

    private journalPath: string;

    // Map of normalized link title -> absolute file path
    private cachedMdFiles: { [title: string]: string } | null = null;

    // Flag to pause background watching during test mass-generation
    public isPaused: boolean = false;

    private _onIndexUpdated = new vscode.EventEmitter<void>();
    public readonly onIndexUpdated = this._onIndexUpdated.event;

    constructor(journalPath: string) {
        this.journalPath = journalPath;
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
        this.tagIndex = {};
        this.linkIndex = {};
        this.fileToTags = {};
        this.cachedMdFiles = null;

        if (!this.journalPath) { return; }

        const files = await getAllMarkdownFiles(this.journalPath);
        this.cachedMdFiles = {};
        for (const file of files) {
            const normalizedTitle = path.basename(file, '.md').replace(/-/g, ' ');
            this.cachedMdFiles[normalizedTitle] = file;
        }

        // FAST BURST SYNC READ: for the massive initial load, async overhead of 2000+ files blocks V8.
        // Doing a pure synchronous memory burst is vastly faster for immediate index generation.
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf8');

                const tags = Array.from(new Set(this.extractTags(content)));
                this.fileToTags[file] = tags;
                for (const tag of tags) {
                    if (!this.tagIndex[tag]) { this.tagIndex[tag] = []; }
                    this.tagIndex[tag].push(file);
                }

                const links = this.extractWikilinks(content);
                this.linkIndex[file] = { linksTo: [], linkedFrom: [] };

                for (const linkTitle of links) {
                    let targetPath = this.resolveLinkPath(file, linkTitle);
                    if (!targetPath) {
                        const journalRoot = getJournalPath() || this.journalPath;
                        targetPath = path.join(journalRoot, `${linkTitle}.md`);
                    }
                    this.linkIndex[file].linksTo.push(targetPath);
                    if (!this.linkIndex[targetPath]) {
                        this.linkIndex[targetPath] = { linksTo: [], linkedFrom: [] };
                    }

                    // Optimization: We are processing files sequentially in initializeIndex.
                    // Instead of an O(N) array includes() scan that grows to 2000 elements,
                    // we can just check if the very last element is the current file.
                    const linkedFromArr = this.linkIndex[targetPath].linkedFrom;
                    if (linkedFromArr.length === 0 || linkedFromArr[linkedFromArr.length - 1] !== file) {
                        linkedFromArr.push(file);
                    }
                }
            } catch (e) {
                console.error(`Error reading ${file} during initializeIndex`, e);
            }
        }

        this._onIndexUpdated.fire();
    }

    public async updateIndexForFile(filePath: string, fireEvent: boolean = true, skipExistsCheck: boolean = false) {
        if (this.isPaused) {
            return;
        }

        // Only touch tags we know this file previously had
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

        // Remove file from links
        const oldLinks = this.linkIndex[filePath]?.linksTo || [];
        for (const linkedToFile of oldLinks) {
            if (this.linkIndex[linkedToFile]) {
                this.linkIndex[linkedToFile].linkedFrom = this.linkIndex[linkedToFile].linkedFrom.filter(p => p !== filePath);
            }
        }

        let fileExists = true;
        if (!skipExistsCheck) {
            try {
                await fs.promises.stat(filePath);
            } catch {
                fileExists = false;
            }
        }

        if (!fileExists) {
            delete this.linkIndex[filePath];
            if (fireEvent) { this._onIndexUpdated.fire(); }
            return;
        }

        this.linkIndex[filePath] = { linksTo: [], linkedFrom: this.linkIndex[filePath]?.linkedFrom || [] };

        const content = await fs.promises.readFile(filePath, 'utf8');

        // Extract tags
        const tags = Array.from(new Set(this.extractTags(content))); // Unique tags only

        this.fileToTags[filePath] = tags;

        for (const tag of tags) {
            if (!this.tagIndex[tag]) {
                this.tagIndex[tag] = [];
            }
            this.tagIndex[tag].push(filePath);
        }

        // Extract Links
        const links = this.extractWikilinks(content);
        for (const linkTitle of links) {
            let targetPath = this.resolveLinkPath(filePath, linkTitle);
            if (!targetPath) {
                const journalRoot = getJournalPath() || this.journalPath;
                targetPath = path.join(journalRoot, `${linkTitle}.md`);
            }
            this.linkIndex[filePath].linksTo.push(targetPath);
            if (!this.linkIndex[targetPath]) {
                this.linkIndex[targetPath] = { linksTo: [], linkedFrom: [] };
            }
            if (!this.linkIndex[targetPath].linkedFrom.includes(filePath)) {
                this.linkIndex[targetPath].linkedFrom.push(filePath);
            }
        }

        if (fireEvent) {
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

        // O(1) Dictionary Lookup
        return this.cachedMdFiles[searchTitle];
    }
}
