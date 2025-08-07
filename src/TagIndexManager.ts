import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface TagIndex { [tag: string]: string[]; }

export class TagIndexManager {
    private tagIndex: TagIndex = {};
    private context: vscode.ExtensionContext;
    private journalPath: string;

    constructor(context: vscode.ExtensionContext, journalPath: string) {
        this.context = context;
        this.journalPath = journalPath;
        this.loadIndex();
    }

    private loadIndex() {
        const storedIndex = this.context.globalState.get<TagIndex>('mdJournalTagIndex', {});
        this.tagIndex = storedIndex;
    }

    private saveIndex() {
        this.context.globalState.update('mdJournalTagIndex', this.tagIndex);
    }

    public async updateIndexForFile(filePath: string) {
        // Remove existing entries for this file
        for (const tag in this.tagIndex) {
            this.tagIndex[tag] = this.tagIndex[tag].filter(p => p !== filePath);
        }

        if (!fs.existsSync(filePath)) {
            this.saveIndex();
            return; // File deleted
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const tags = this.extractTags(content);

        tags.forEach(tag => {
            if (!this.tagIndex[tag]) {
                this.tagIndex[tag] = [];
            }
            if (!this.tagIndex[tag].includes(filePath)) {
                this.tagIndex[tag].push(filePath);
            }
        });
        this.saveIndex();
    }

    private extractTags(content: string): string[] {
        const tagRegex = /(?:^|\s)#[a-zA-Z0-9_\-]+/g;
        const matches = content.match(tagRegex);
        if (matches) {
            return matches.map(match => match.trim().substring(1));
        }
        return [];
    }

    public getTags(): string[] {
        return Object.keys(this.tagIndex).sort();
    }

    public getFilesForTag(tag: string): string[] {
        return this.tagIndex[tag] || [];
    }

    public setJournalPath(newPath: string) {
        this.journalPath = newPath;
        this.initializeIndex();
    }

    public async initializeIndex() {
        this.tagIndex = {}; // Clear existing index
        const files = await this.getAllMarkdownFiles(this.journalPath);
        for (const file of files) {
            await this.updateIndexForFile(file);
        }
        this.saveIndex();
    }

    private async getAllMarkdownFiles(dir: string): Promise<string[]> {
        let markdownFiles: string[] = [];
        if (!fs.existsSync(dir)) {
            return markdownFiles;
        }
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                markdownFiles = markdownFiles.concat(await this.getAllMarkdownFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                markdownFiles.push(fullPath);
            }
        }
        return markdownFiles;
    }
}
