const PDFDocument = require('pdfkit');

/**
 * Generates a PDF document with order details
 * @param {Array} orderData - Array of order items
 * @param {string} fileName - Base name for the PDF file
 * @returns {Promise<Buffer>} - PDF file as buffer
 */
function createPdf(orderData, fileName = 'zamowienie') {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                bufferPages: true
            });
            
            const chunks = [];
            
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Set document metadata
            doc.info['Title'] = `Zamówienie ${new Date().toLocaleDateString('pl-PL')}`;
            doc.info['Author'] = 'System zamówień';
            doc.info['Subject'] = 'Szczegóły zamówienia';

            // Add header
            doc.fontSize(20)
               .font('Helvetica-Bold')
               .text('ZAMÓWIENIE', { align: 'center' });
            
            doc.moveDown(0.5);
            
            // Add order details
            doc.fontSize(12)
               .font('Helvetica')
               .text(`Data: ${new Date().toLocaleString('pl-PL')}`)
               .text(`Liczba pozycji: ${orderData.length}`);
            
            doc.moveDown(2);
            
            // Add order items table
            const tableTop = 150;
            let y = tableTop;
            
            // Table header
            doc.font('Helvetica-Bold')
               .fontSize(10)
               .text('Lp.', 50, y)
               .text('Identyfikator', 80, y, { width: 200, align: 'left' })
               .text('Indeks', 300, y)
               .text('Ilość', 400, y, { width: 50, align: 'right' })
               .text('Cena jdn.', 450, y, { width: 70, align: 'right' })
               .text('Wartość', 520, y, { width: 70, align: 'right' });
            
            // Draw header line
            y += 20;
            doc.moveTo(50, y)
               .lineTo(550, y)
               .stroke();
            
            y += 10;
            doc.font('Helvetica');
            
            // Table rows
            orderData.forEach((item, index) => {
                const position = index + 1;
                const lineValue = (item.price || 0) * (item.quantity || 0);
                
                // Check if we need a new page
                if (y > 750) {
                    doc.addPage();
                    y = 50;
                }
                
                doc.fontSize(10)
                   .text(position.toString(), 50, y)
                   .text(item.name || '-', 80, y, { 
                       width: 200, 
                       lineGap: 5,
                       ellipsis: true
                   })
                   .text(item.pc_id || '-', 300, y, { width: 80 })
                   .text(item.quantity.toString(), 400, y, { width: 50, align: 'right' })
                   .text(`${(item.price || 0).toFixed(2)} zł`, 450, y, { width: 70, align: 'right' })
                   .text(`${lineValue.toFixed(2)} zł`, 520, y, { width: 70, align: 'right' });
                
                y += 20;
            });
            
            // Add total
            const total = orderData.reduce((sum, item) => 
                sum + ((item.price || 0) * (item.quantity || 0)), 0);
            
            // Draw total line
            y = Math.max(y, 750);
            doc.moveTo(50, y)
               .lineTo(550, y)
               .stroke();
            
            y += 15;
            
            doc.font('Helvetica-Bold')
               .fontSize(12)
               .text('RAZEM DO ZAPŁATY:', 300, y, { width: 220, align: 'right' })
               .text(`${total.toFixed(2)} zł`, 520, y, { width: 70, align: 'right' });
            
            // Add footer
            doc.fontSize(8)
               .font('Helvetica')
               .text(
                   `Wygenerowano: ${new Date().toLocaleString('pl-PL')} | ` +
                   `Liczba pozycji: ${orderData.length} | ` +
                   `Strona ${doc.bufferedPageRange().count} z ${doc.bufferedPageRange().count}`,
                   50, 800, { align: 'center' }
               );
            
            doc.end();
        } catch (error) {
            console.error('Błąd podczas generowania PDF:', error);
            reject(error);
        }
    });
}

module.exports = { createPdf };
