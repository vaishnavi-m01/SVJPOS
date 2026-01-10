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

    const P = getPrinterProfile(printerSize) as any;

    // Conditional commands based on forPreview
    const b_on = forPreview ? '[B]' : BOLD_ON;
    const b_off = forPreview ? '[/B]' : BOLD_OFF;
    const center = forPreview ? '' : CENTER;
    const left = forPreview ? '' : LEFT;
    const f_b_on = forPreview ? '' : (printerSize === '58mm' ? FONT_B_ON : '');
    const f_b_off = forPreview ? '' : (printerSize === '58mm' ? FONT_B_OFF : '');

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

    // r += center;
    // r += b_on;
    // r += (store?.name?.trim() ? store.name : 'SVJ POS');
    // r += b_off;
    // r += '\n';

    r += center;
    r += b_on;
    // r += (store?.name?.trim() ? store.name : 'SVJ POS') + '\n';
    const cleanStoreName =
        store?.name?.trim()
            ? store.name.replace(/^\d+\s*/, '')
            : 'SVJPOS';

    // r += cleanStoreName + '\n';

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

    // r += center + b_on + '======== PAY TM BILL ========\n' + b_off;
    // r += left;
    r += center + b_on + '======== PAY TM BILL ========\n' + b_off + left + '\n';

    // Bill Info

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

    // const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} AM`;
    r += `Bill No: ${order.orderNumber}\n`;
    r += `Bill Date: ${formattedDate}\n`;
    r += LINE_EQ;

    // Table Header
    r += col('Product', P.ITEM) + ' ' +
        col('Qty', P.QTY, 'right') + ' ' +
        col('MRP', P.MRP, 'right') + ' ' +
        col('Rate', P.RATE, 'right') + ' ' +
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

        const nameLines = wrapText(it.name, P.ITEM - 4); // Reserve space for serial

        nameLines.forEach((line, index) => {
            if (index === 0) {
                // First line → include serial number
                r += col(serial + '. ' + line, P.ITEM) + ' ' +
                    col(qty.toString(), P.QTY, 'right') + ' ' +
                    col(mrp.toFixed(2), P.MRP, 'right') + ' ' +
                    col(rate.toFixed(2), P.RATE, 'right') + ' ' +
                    col(amount.toFixed(2), P.AMT, 'right') + '\n';
            } else {
                // Next lines → only product name, other columns empty
                r += col('    ' + line, P.ITEM) + ' ' +
                    col('', P.QTY) + ' ' +
                    col('', P.MRP) + ' ' +
                    col('', P.RATE) + ' ' +
                    col('', P.AMT) + '\n';
            }
        });

        serial++;
    });


    // const netAmount = Math.round(totalAmount);
    // const roundOff = netAmount - totalAmount;

    let gstTotal = 0;

    if (order.gstSummary && order.gstSummary.length > 0) {
        order.gstSummary.forEach(g => {
            gstTotal += g.sgst + g.cgst;
        });
    }

    // const grossAmount = totalAmount + gstTotal;
    const netBeforeRound = totalAmount + gstTotal;
    const netAmount = Math.round(netBeforeRound);
    const roundOff = netAmount - netBeforeRound;


    r += LINE;
    // Dynamic column widths for dual-column footer
    const lbl1 = 10;
    const val1 = 8;
    const gap = 2;
    const lbl2 = 12;
    const val2 = P.WIDTH - (lbl1 + val1 + gap + lbl2);

    // Row 1: Qty and Total Amt
    r += col('Qty      :', lbl1) + col(totalQtyCount.toFixed(3), val1, 'left') + col('  ', gap) +
        b_on + col('Total Amt  :', lbl2) + col(totalAmount.toFixed(2), val2, 'right')
        + b_off + '\n';

    // Row 2: Weight and Round off
    r += col('Weight   :', lbl1) + col(totalWeight.toFixed(3), val1, 'left') + col('  ', gap) +
        col('Round off  :', lbl2) + col(roundOff.toFixed(2), val2, 'right') + '\n';
    // Row 3: Tax (GST)
    r += col('', lbl1) + col('', val1) + col('  ', gap) +
        col('Tax (GST)  :', lbl2) + col(gstTotal.toFixed(2), val2, 'right') + '\n';


    r += LINE;
    // Net Amount 
    r += b_on + col('Net Amount     :', 18) + col(netAmount.toFixed(2), P.WIDTH - 18, 'right') + b_off + '\n';
    r += LINE;

    r += col('Total Items    :', 18) + col(order.items.length.toString(), P.WIDTH - 18, 'right') + '\n';
    r += LINE;

    // Paymode 
    const pmTxt = `Paymode - ${order.payment}`;
    r += b_on + col(pmTxt, P.WIDTH - 12) + col(netAmount.toFixed(2), 12, 'right') + b_off + '\n';

    // r += 'Exclusive of GST TAX\n';
    const hasGst = order.gstSummary && order.gstSummary.some(g => g.sgst + g.cgst > 0);

    r += hasGst
        ? 'Exclusive of GST TAX\n'
        : 'Inclusive of GST TAX\n';

    r += 'GST Summary - Details :\n';
    r += LINE;

    // Dynamic GST Columns
    const g1 = 5;  // Perc
    const g2 = 8;  // Taxable
    const g3 = 8;  // SGST
    const g4 = 8;  // CGST
    const g5 = P.WIDTH - (g1 + g2 + g3 + g4); // Total

    r += col('Perc', g1) + col('Taxable', g2, 'right') + col('SGST', g3, 'right') + col('CGST', g4, 'right') + col('GST Amt', g5, 'right') + '\n';
    r += LINE;
    if (order.gstSummary && order.gstSummary.length > 0) {
        let gstTaxableTotal = 0;
        let gstSgstTotal = 0;
        let gstCgstTotal = 0;
        let gstGrandTotal = 0;

        order.gstSummary.forEach(g => {
            // const rowTotal = g.taxable + g.sgst + g.cgst;
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
            col('Total', g1) +
            col(gstTaxableTotal.toFixed(2), g2, 'right') +
            col(gstSgstTotal.toFixed(2), g3, 'right') +
            col(gstCgstTotal.toFixed(2), g4, 'right') +
            col(gstGrandTotal.toFixed(2), g5, 'right') +
            b_off + '\n';
    }

    // r += col('0.00', g1) + col(totalAmount.toFixed(2), g2, 'right') + col('0.00', g3, 'right') + col('0.00', g4, 'right') + col(totalAmount.toFixed(2), g5, 'right') + '\n';
    // r += LINE;
    // r += b_on + col('Total', g1) + col(totalAmount.toFixed(2), g2, 'right') + col('0.00', g3, 'right') + col('0.00', g4, 'right') + col(totalAmount.toFixed(2), g5, 'right') + b_off + '\n';
    r += LINE_EQ;

    r += col('Total MRP: ', 18) + col(totalMRP.toFixed(2), 12, 'left') + '\n';
    r += col('Total Rate: ', 18) + col(totalRate.toFixed(2), 12, 'left') + '\n';
    r += col('Today Savings: ', 18) + col(Math.max(0, totalMRP - totalRate).toFixed(2), 12, 'left') + '\n';
    r += LINE_EQ;

    r += f_b_off; // Close Font B 

    r += center + 'Thank you! Visit Again\n' + left;

    // r += center + '33AAPFP1742F1ZC\n' + left;
    // r += LINE;

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
