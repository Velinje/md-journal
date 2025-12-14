import * as path from 'path';

export function getFormattedTimestamp(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);

    return format
        .replace('YYYY', year.toString())
        .replace('MM', month)
        .replace('DD', day)
        .replace('dddd', dayOfWeek)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

export function getJournalFolderPath(date: Date, folderStructure: string): string {
    const year = date.getFullYear().toString();
    const monthNumber = (date.getMonth() + 1).toString().padStart(2, '0');
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
    const dayNumber = date.getDate().toString().padStart(2, '0');
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);

    let folderPath = folderStructure
        .replace('YYYY', year)
        .replace('MMMM', monthName)
        .replace('MM', monthNumber)
        .replace('dddd', dayName)
        .replace('DD', dayNumber);

    folderPath = folderPath.replace(/>/g, path.sep);

    return folderPath;
}
