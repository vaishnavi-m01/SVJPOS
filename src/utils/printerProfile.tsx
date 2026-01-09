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

export function getPrinterProfile(size: PrinterSize) {
    if (size === '80mm') {
        return {
            WIDTH: 48,
            ITEM: 18,
            QTY: 5,
            MRP: 7,
            RATE: 7,
            AMT: 7,
        };
    }

    // Default = 58mm High Density (Font B)
    return {
        WIDTH: 40,   // 58mm Font B standard is 42, using 40 for safety
        ITEM: 14,
        QTY: 4,
        MRP: 6,
        RATE: 6,
        AMT: 6,
    };
}
