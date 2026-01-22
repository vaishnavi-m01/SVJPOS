export type PrinterSize = '58mm' | '80mm';

/* ESC/POS Commands */
export const BOLD_ON = '\x1B\x45\x01';
export const BOLD_OFF = '\x1B\x45\x00';
export const CENTER = '\x1B\x61\x01';
export const LEFT = '\x1B\x61\x00';
export const DOUBLE_ON = '\x1D\x21\x11';
export const DOUBLE_OFF = '\x1D\x21\x00';
export const FONT_B_ON = '\x1B\x4D\x01';
export const FONT_B_OFF = '\x1B\x4D\x00';

export interface PrinterProfile {
    WIDTH: number;
    ITEM: number;
    QTY: number;
    MRP: number;
    RATE: number;
    AMT: number;
}

export function getPrinterProfile(size: PrinterSize, useCondensed: boolean = false): PrinterProfile {
    if (size === '80mm') {
        return {
            WIDTH: 48,
            ITEM: 7, // Dynamic in main logic, this is just a safe default
            QTY: 4,
            MRP: 11,
            RATE: 11,
            AMT: 11,
        };
    }

    // 58mm Configuration
    if (useCondensed) {
        // Font B (Condensed) - ~42 chars usually
        return {
            WIDTH: 42,
            ITEM: 2, // Will be calculated dynamically
            QTY: 4,
            MRP: 10,
            RATE: 10,
            AMT: 11,
        };
    } else {
        // Font A (Normal) - ~32 chars usually
        return {
            WIDTH: 32,
            ITEM: 2, // Will be calculated dynamically
            QTY: 3,
            MRP: 8,
            RATE: 8,
            AMT: 9,
        };
    }
}
