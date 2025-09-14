import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getAllMarkdownFiles } from './utilities';

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

    public async updateIndexForFile(filePath: string, save: boolean = true) {
        for (const tag in this.tagIndex) {
            this.tagIndex[tag] = this.tagIndex[tag].filter(p => p !== filePath);
        }

        if (!fs.existsSync(filePath)) {
            if (save) {
                this.saveIndex();
            }
            return;
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

        if (save) {
            this.saveIndex();
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
        this.tagIndex = {};
        const files = await getAllMarkdownFiles(this.journalPath);
        for (const file of files) {
            await this.updateIndexForFile(file, false);
        }
        this.saveIndex();
    }
}