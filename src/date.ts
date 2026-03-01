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

    return folderPath;
}

export function getDateFromPath(folderPath: string, folderStructure: string, journalPath: string): Date | null {
    if (!journalPath) {
        return null;
    }

    const relativePath = path.relative(journalPath, folderPath);
    const pathParts = relativePath.split(path.sep);
    const structureParts = folderStructure.split(/[\/\\]/);

    let year, month, day;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    for (let i = 0; i < structureParts.length; i++) {
        const sPart = structureParts[i];
        const pPart = pathParts[i];
        if (!pPart) {
            continue;
        }

        const yyyy = sPart.includes('YYYY');
        const mmmm = sPart.includes('MMMM');
        const mm = sPart.includes('MM');
        const dd = sPart.includes('DD');

        const regexStr = '^' + sPart
            .replace('YYYY', '(\\d{4})')
            .replace('MMMM', `(${monthNames.join('|')})`)
            .replace('MM', '(\\d{2})')
            .replace('dddd', '[a-zA-Z]+')
            .replace('DD', '(\\d{2})') + '$';

        const matches = pPart.match(new RegExp(regexStr));
        if (!matches) {
            continue;
        }

        let matchIndex = 1;
        if (yyyy) {
            year = parseInt(matches[matchIndex++]);
        }
        if (mmmm) {
            month = monthNames.indexOf(matches[matchIndex++]);
        } else if (mm) {
            month = parseInt(matches[matchIndex++]) - 1;
        }
        if (dd) {
            day = parseInt(matches[matchIndex++]);
        }
    }

    if (year !== undefined) {
        return new Date(year, month !== undefined ? month : 0, day !== undefined ? day : 1);
    }

    return null;
}
