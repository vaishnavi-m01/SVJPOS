import { Order } from "../types";
import { getPrinterProfile, PrinterSize, BOLD_ON, BOLD_OFF, CENTER, LEFT, FONT_B_ON, FONT_B_OFF } from "./printerProfile";

/* Helpers */
function col(text: string, width: number, align: 'left' | 'right' = 'left') {
    text = text.toString();
    if (text.length > width) text = text.substring(0, width);
    return align === 'left' ? text.padEnd(width) : text.padStart(width);
}

/* MAIN FUNCTION */
export function buildReceipt(order: Order, printerSize: PrinterSize,
    store: { name?: string; location?: string; phone?: string }, forPreview: boolean = false): string {

    // 1. Analyze Data to Determine Layout Requirements
    let maxQtyLen = 0;
    let maxMrpLen = 0;
    let maxRateLen = 0;
    let maxAmtLen = 0;

    order.items.forEach(it => {
        const qty = it.qty ?? 0;
        const mrp = (it.mrp && it.mrp > 0 ? it.mrp : it.rate) ?? 0;
        const rate = it.rate ?? 0;
        const amount = qty * rate;

        maxQtyLen = Math.max(maxQtyLen, qty.toString().length);
        maxMrpLen = Math.max(maxMrpLen, mrp.toFixed(2).length);
        maxRateLen = Math.max(maxRateLen, rate.toFixed(2).length);
        maxAmtLen = Math.max(maxAmtLen, amount.toFixed(2).length);
    });

    // 2. Select Font/Profile based on content fit (only for 58mm)
    let useCondensed = false;
    let P = getPrinterProfile(printerSize, false); // Try Normal First

    if (printerSize === '58mm') {
        const spacer = 4; // Spaces between cols
        const serial = 2; // "1."

        // Increase reserved space for Name to ensure we don't squeeze it too much in Normal font.
        // If we can't give at least 10 chars to name, we should switch to Condensed.
        const minSafeName = 10;

        // Check if Normal Font (32 cols) can hold the values + safe name width
        const neededNormal = serial + minSafeName + Math.max(P.QTY, maxQtyLen) + Math.max(P.MRP, maxMrpLen) + Math.max(P.RATE, maxRateLen) + Math.max(P.AMT, maxAmtLen) + spacer;

        if (neededNormal > 32) {
            useCondensed = true;
            P = getPrinterProfile(printerSize, true); // Switch to Condensed (42 cols)
        }
    }

    // 3. Finalize Column Widths dynamic to content
    // We want to give maximum space to Item Name

    // 3. Finalize Column Widths
    // Use strict minimums for readability
    const minQty = 3;
    const minMrp = 3;
    const minRate = 4;
    const minAmt = 3;

    const spaceQty = Math.max(minQty, maxQtyLen);
    const spaceMrp = Math.max(minMrp, maxMrpLen);
    const spaceRate = Math.max(minRate, maxRateLen);
    const spaceAmt = Math.max(minAmt, maxAmtLen);

    // Dynamic Spacers logic
    // Standard: 1 space between columns (4 total gaps)
    // If layout is tight on 58mm, we set gaps to 0.
    let colSpacer = 1;
    let serialWidth = 3; // "1. "

    let totalFixed = serialWidth + spaceQty + spaceMrp + spaceRate + spaceAmt + (4 * colSpacer);
    let remainingForItem = P.WIDTH - totalFixed;

    // Emergency Space Saving
    if (remainingForItem < 6) {
        // Not enough space for name!
        // 1. Remove spacers
        colSpacer = 0;
        totalFixed = serialWidth + spaceQty + spaceMrp + spaceRate + spaceAmt; // 0 gaps
        remainingForItem = P.WIDTH - totalFixed;

        // 2. If still tight, clamp name to 6 and suffer line overflow (better than vertical crash)
        // Or actually, if we clamp to 6, the line WILL overflow P.WIDTH which is bad.
        // But preventing wrapText(1) is critical.
    }

    P.ITEM = Math.max(6, remainingForItem);

    // Assign to Profile
    P.QTY = spaceQty;
    P.MRP = spaceMrp;
    P.RATE = spaceRate;
    P.AMT = spaceAmt;

    // Helper string for gap
    const Gap = ' '.repeat(colSpacer);

    // Conditional commands based on forPreview
    const b_on = forPreview ? '[B]' : BOLD_ON;
    const b_off = forPreview ? '[/B]' : BOLD_OFF;
    const center = forPreview ? '' : CENTER;
    const left = forPreview ? '' : LEFT;

    // Font B logic:
    // If 58mm AND useCondensed -> Send Font B command
    // If 80mm -> Standard
    const f_b_on = forPreview ? '' : (useCondensed ? FONT_B_ON : '');
    const f_b_off = forPreview ? '' : (useCondensed ? FONT_B_OFF : '');


    // Bold Dashes for Normal lines (Visible but standard)
    const LINE = b_on + '-'.repeat(P.WIDTH) + b_off + '\n';
    // Bold Equals for Important lines (Header, Totals)
    const LINE_EQ = b_on + '='.repeat(P.WIDTH) + b_off + '\n';


    let r = forPreview ? '' : '\x1b\x40';
    r += f_b_on;

    // ================= HEADER =================
    const hasStoreDetails =
        store?.name?.trim() ||
        store?.location?.trim() ||
        store?.phone?.trim();

    r += center;
    r += b_on;

    const cleanStoreName =
        store?.name?.trim()
            ? store.name.replace(/^\d+\s*/, '')
            : 'SVJPOS';

    wrapByWidth(cleanStoreName, P.WIDTH).forEach(line => {
        r += center + line + '\n';
    });


    r += b_off;
    r += left;

    if (hasStoreDetails) {
        if (store.location?.trim()) {
            wrapByWidth(store.location, P.WIDTH).forEach(line => {
                r += center + line + '\n';
            });
        }

        if (store.phone?.trim()) {
            wrapByWidth('Ph: ' + store.phone, P.WIDTH).forEach(line => {
                r += center + line + '\n';
            });
        }
        r += '\n'; // Single gap before banner
    } else {
        // DEFAULT HEADER
        r += center + 'NO.21, SVJPOS,\n';
        r += center + 'SURANDAI,\n';
        r += center + 'Ph:6385532772,9444391913\n';
    }

    r += center + b_on + '======== PAY TM BILL ========\n' + b_off + left + '\n';

    // Bill Info
    const date = new Date(order.date);
    let hours = date.getHours(); // 0–23
    const minutes = date.getMinutes().toString().padStart(2, '0');

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours === 0 ? 12 : hours;

    const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${date.getFullYear()} ${hours
            .toString()
            .padStart(2, '0')}:${minutes} ${ampm}`;

    r += `Bill No: ${order.orderNumber}\n`;
    r += `Bill Date: ${formattedDate}\n`;
    r += LINE_EQ;

    // Table Header
    r += col('Product', P.ITEM + serialWidth) + Gap +
        col('Qty', P.QTY, 'right') + Gap +
        col('MRP', P.MRP, 'right') + Gap +
        col('Rate', P.RATE, 'right') + Gap +
        col('Amt', P.AMT, 'right') + '\n';
    r += LINE;

    // Totals
    let totalQtyCount = 0;
    let totalWeight = 0;
    let totalMRP = 0;
    let totalRate = 0;
    let totalAmount = 0;

    // Items
    let serial = 1;

    order.items.forEach(it => {
        const qty = it.qty ?? 0;
        const mrp = (it.mrp && it.mrp > 0 ? it.mrp : it.rate) ?? 0;


        const rate = it.rate ?? 0;
        const amount = qty * rate;

        totalQtyCount += qty;
        if (qty < 1 || qty % 1 !== 0) totalWeight += qty;
        totalMRP += qty * mrp;
        totalRate += qty * rate;
        totalAmount += amount;

        // Wrap Item Name
        // Note: P.ITEM here excludes serial width? No, in header we used P.ITEM + serialWidth.
        // Let's keep logic consistent.
        const nameLines = wrapText(it.name, P.ITEM);

        nameLines.forEach((line, index) => {
            if (index === 0) {
                // First line → include serial number
                // serialWidth includes the dot and space e.g. "1. "
                const sTxt = serial + '. ';
                r += col(sTxt + line, P.ITEM + serialWidth) + Gap +
                    col(qty.toString(), P.QTY, 'right') + Gap +
                    col(mrp.toFixed(2), P.MRP, 'right') + Gap +
                    col(rate.toFixed(2), P.RATE, 'right') + Gap +
                    col(amount.toFixed(2), P.AMT, 'right') + '\n';
            } else {
                // Next lines → only product name
                r += col('   ' + line, P.ITEM + serialWidth) + Gap +
                    col('', P.QTY) + Gap +
                    col('', P.MRP) + Gap +
                    col('', P.RATE) + Gap +
                    col('', P.AMT) + '\n';
            }
        });

        serial++;
    });

    let gstTotal = 0;
    if (order.gstSummary && order.gstSummary.length > 0) {
        order.gstSummary.forEach(g => {
            gstTotal += g.sgst + g.cgst;
        });
    }

    const netBeforeRound = totalAmount + gstTotal;
    const netAmount = Math.round(netBeforeRound);
    const roundOff = netAmount - netBeforeRound;


    r += LINE;
    // Dynamic column widths for dual-column footer
    // Adjust based on P.WIDTH
    // Try to keep labels fixed but values flexible if needed, or split 50/50
    // Simple approach: Label (~10-12), Value (~8-10), Gap (2)

    // We'll use proportional spacing
    const halfWidth = Math.floor((P.WIDTH - 2) / 2); // -2 for gap
    const lblW = Math.floor(halfWidth * 0.6);
    const valW = halfWidth - lblW;

    // Row 1: Qty and Total Amt
    r += col('Qty:', lblW) + col(totalQtyCount.toFixed(3), valW, 'right') + '  ' +
        b_on + col('Total:', lblW) + col(totalAmount.toFixed(2), valW, 'right') + b_off + '\n';

    // Row 2: Weight and Round off
    r += col('Wgt:', lblW) + col(totalWeight.toFixed(3), valW, 'right') + '  ' +
        col('R.Off:', lblW) + col(roundOff.toFixed(2), valW, 'right') + '\n';

    // Row 3: Tax (GST)
    r += col('', lblW) + col('', valW) + '  ' +
        col('Tax:', lblW) + col(gstTotal.toFixed(2), valW, 'right') + '\n';


    r += LINE;
    // Net Amount 
    r += b_on + col('Net Amount:', P.WIDTH - 12) + col(netAmount.toFixed(2), 12, 'right') + b_off + '\n';
    r += LINE;

    r += col('Total Items:', P.WIDTH - 10) + col(order.items.length.toString(), 10, 'right') + '\n';
    r += LINE;

    // Paymode 
    const pmTxt = `Paymode - ${order.payment}`;
    r += b_on + col(pmTxt, P.WIDTH - 12) + col(netAmount.toFixed(2), 12, 'right') + b_off + '\n';

    const hasGst = order.gstSummary && order.gstSummary.some(g => g.sgst + g.cgst > 0);
    r += hasGst
        ? 'Exclusive of GST TAX\n'
        : 'Inclusive of GST TAX\n';

    r += 'GST Summary - Details :\n';
    r += LINE;

    // Dynamic GST Columns
    const g1 = 4;  // Perc
    const g2 = 7;  // Taxable
    const g3 = 7;  // SGST
    const g4 = 7;  // CGST
    const g5 = P.WIDTH - (g1 + g2 + g3 + g4); // Total

    r += col('Perc', g1) + col('Taxable', g2, 'right') + col('SGST', g3, 'right') + col('CGST', g4, 'right') + col('Total', g5, 'right') + '\n';
    r += LINE;

    if (order.gstSummary && order.gstSummary.length > 0) {
        let gstTaxableTotal = 0;
        let gstSgstTotal = 0;
        let gstCgstTotal = 0;
        let gstGrandTotal = 0;

        order.gstSummary.forEach(g => {
            const rowTotal = g.sgst + g.cgst;
            gstTaxableTotal += g.taxable;
            gstSgstTotal += g.sgst;
            gstCgstTotal += g.cgst;
            gstGrandTotal += rowTotal;

            r += col(`${g.perc}%`, g1) +
                col(g.taxable.toFixed(2), g2, 'right') +
                col(g.sgst.toFixed(2), g3, 'right') +
                col(g.cgst.toFixed(2), g4, 'right') +
                col(rowTotal.toFixed(2), g5, 'right') + '\n';
        });

        r += LINE;

        r += b_on +
            col('Tot', g1) +
            col(gstTaxableTotal.toFixed(2), g2, 'right') +
            col(gstSgstTotal.toFixed(2), g3, 'right') +
            col(gstCgstTotal.toFixed(2), g4, 'right') +
            col(gstGrandTotal.toFixed(2), g5, 'right') +
            b_off + '\n';
    }

    r += LINE_EQ;

    // Footer Summaries - ensure they fit
    r += col('Total MRP: ', P.WIDTH - 12) + col(totalMRP.toFixed(2), 12, 'right') + '\n';
    r += col('Total Rate: ', P.WIDTH - 12) + col(totalRate.toFixed(2), 12, 'right') + '\n';
    r += col('Today Savings: ', P.WIDTH - 12) + col(Math.max(0, totalMRP - totalRate).toFixed(2), 12, 'right') + '\n';
    r += LINE_EQ;

    r += f_b_off; // Close Font B 

    r += center + 'Thank you! Visit Again\n' + left;

    return r;
}


function wrapText(text: string, width: number): string[] {
    if (!text) return [];
    const lines: string[] = [];
    const words = text.split(/\s+/);
    let currentLine = '';

    words.forEach(word => {
        if (!word) return;

        if (word.length > width) {
            if (currentLine) {
                lines.push(currentLine);
                currentLine = '';
            }
            for (let i = 0; i < word.length; i += width) {
                const chunk = word.substring(i, i + width);
                if (chunk.length === width) {
                    lines.push(chunk);
                } else {
                    currentLine = chunk;
                }
            }
        } else if ((currentLine + (currentLine ? ' ' : '') + word).length <= width) {
            currentLine += (currentLine ? ' ' : '') + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
}


function wrapByWidth(text: string, width: number): string[] {
    if (!text) return [];
    return wrapText(text, width);
}
