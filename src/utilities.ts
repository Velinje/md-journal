import * as fs from 'fs';
import * as path from 'path';

export async function getAllMarkdownFiles(dir: string): Promise<string[]> {
    let markdownFiles: string[] = [];
    if (!fs.existsSync(dir)) {
        return markdownFiles;
    }
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            markdownFiles = markdownFiles.concat(await getAllMarkdownFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            markdownFiles.push(fullPath);
        }
    }
    return markdownFiles;
}

export function getFormattedTimestamp(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return format
        .replace('YYYY', year.toString())
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

export function getJournalFolderPath(date: Date, folderStructure: string): string {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    let folderPath = folderStructure
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day);
    folderPath = folderPath.replace(/>/g, path.sep);
    return folderPath;
}

export function sanitizeFileName(name: string): string {
    const sanitized = name.replace(/^[#\s]+/, '').replace(/[<>:"/\\|?*]/g, '');
    return sanitized.replace(/\s/g, '-');
}