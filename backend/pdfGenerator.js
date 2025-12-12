const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Register fonts for Polish characters
const regularFontPath = path.join(__dirname, '../assets/fonts/NotoSans-Regular.ttf');
const boldFontPath = path.join(__dirname, '../assets/fonts/NotoSans-Bold.ttf');

if (fs.existsSync(regularFontPath)) {
    console.log('Rejestracja fontu NotoSans-Regular dla polskich znaków');
} else {
    console.warn('Font NotoSans-Regular nie znaleziony, używam domyślnego');
}

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
            
            // Register fonts for Polish characters if available
            if (fs.existsSync(regularFontPath)) {
                doc.registerFont('NotoSans', regularFontPath);
                doc.registerFont('NotoSans-Bold', boldFontPath);
                console.log('Fonty NotoSans zarejestrowane dla PDF');
            }
            
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
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('ZAMÓWIENIE', { align: 'center' });
            
            doc.moveDown(0.5);
            
            // Add order details
            doc.fontSize(12)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(`Data: ${new Date().toLocaleString('pl-PL')}`)
               .text(`Liczba pozycji: ${orderData.length}`);
            
            doc.moveDown(2);
            
            // Add order items table
            const tableTop = 150;
            let y = tableTop;
            
            // Table header
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .fontSize(9)
               .text('Lp.', 50, y)
               .text('Identyfikator', 70, y, { width: 130, align: 'left' })
               .text('Indeks', 200, y, { width: 60 })
               .text('Lokalizacja', 260, y, { width: 90 })
               .text('Ilość', 355, y, { width: 40, align: 'right' })
               .text('Cena jdn.', 400, y, { width: 60, align: 'right' })
               .text('Wartość', 465, y, { width: 60, align: 'right' });
            
            // Draw header line
            y += 20;
            doc.moveTo(50, y)
               .lineTo(550, y)
               .stroke();
            
            y += 10;
            doc.font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica');
            
            // Table rows
            orderData.forEach((item, index) => {
                const position = index + 1;
                const lineValue = (item.price || 0) * (item.quantity || 0);
                
                // Check if we need a new page
                if (y > 750) {
                    doc.addPage();
                    y = 50;
                }
                
                // Lokalizacja: dla PM = miejscowość, dla KI = obiekt
                const locationDisplay = item.locationName || '-';
                
                doc.fontSize(9)
                   .text(position.toString(), 50, y)
                   .text(item.name || '-', 70, y, { 
                       width: 130, 
                       lineGap: 5,
                       ellipsis: true
                   })
                   .text(item.pc_id || '-', 200, y, { width: 60 })
                   .text(locationDisplay, 260, y, { width: 90, ellipsis: true })
                   .text(item.quantity.toString(), 355, y, { width: 40, align: 'right' })
                   .text(`${(item.price || 0).toFixed(2)} zł`, 400, y, { width: 60, align: 'right' })
                   .text(`${lineValue.toFixed(2)} zł`, 465, y, { width: 60, align: 'right' });
                
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
            
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .fontSize(12)
               .text('RAZEM DO ZAPŁATY:', 300, y, { width: 220, align: 'right' })
               .text(`${total.toFixed(2)} zł`, 520, y, { width: 70, align: 'right' });
            
            // Add footer
            doc.fontSize(8)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
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

// Mapowanie source na skrót (PM/KI/Im/H/Ok)
const SOURCE_LABELS = {
    MIEJSCOWOSCI: 'PM',
    KATALOG_INDYWIDUALNY: 'KI',
    KLIENCI_INDYWIDUALNI: 'KI',
    IMIENNE: 'Im',
    HASLA: 'H',
    OKOLICZNOSCIOWE: 'Ok'
};

// Helper function do formatowania pełnej lokalizacji (PM/KI + nazwa)
function formatLocationFull(item) {
    const sourceLabel = SOURCE_LABELS[item?.source] || 'PM';
    const locationName = item?.locationName || '-';
    if (locationName === '-') {
        return '-';
    }
    return `${sourceLabel} ${locationName}`;
}

// Parser projectQuantities: obsługuje nowy format JSON [{ projectNo, qty }] oraz stary CSV
function parseProjectQuantities(item) {
    if (!item || !item.projectQuantities) {
        return null;
    }

    let raw = item.projectQuantities;

    // Nowy format: JSON (string lub tablica obiektów)
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            raw = parsed;
        } catch (e) {
            raw = null;
        }
    }

    if (Array.isArray(raw) && raw.length > 0) {
        if (typeof raw[0] === 'object' && raw[0] !== null && 'projectNo' in raw[0]) {
            return raw.map(p => ({
                projectNo: p.projectNo,
                qty: p.qty
            }));
        }
    }

    // Stary format: selectedProjects i projectQuantities jako CSV
    const projects = String(item.selectedProjects || '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);
    const quantities = String(item.projectQuantities || '')
        .split(',')
        .map(q => q.trim())
        .filter(Boolean);

    if (!projects.length || projects.length !== quantities.length) {
        return null;
    }

    return projects.map((p, i) => ({
        projectNo: p,
        qty: Number(quantities[i]) || 0
    }));
}

// Helper function do formatowania skróconej informacji o projektach do kolumny tabeli
function formatProjectsShort(item) {
    const parsed = parseProjectQuantities(item);
    if (parsed && parsed.length > 0) {
        return parsed.map(p => `${p.projectNo}: ${p.qty}`).join(', ');
    }
    return item?.selectedProjects || '-';
}

// Helper function do formatowania szczegółowego podziału na projekty (linia pod pozycją)
function formatProjectBreakdown(item) {
    const parsed = parseProjectQuantities(item);
    if (!parsed || parsed.length === 0) {
        return null;
    }

    let breakdown = 'Podział: ';
    for (let i = 0; i < parsed.length; i++) {
        if (i > 0) breakdown += ', ';
        breakdown += `Projekt ${parsed[i].projectNo}: ${parsed[i].qty} szt`;
    }

    // Dodaj źródło prawdy
    const source = (item.quantitySource || 'total').toLowerCase();
    let sourceText;
    if (source === 'perproject' || source === 'projects') {
        sourceText = 'suma projektów';
    } else {
        sourceText = 'ilość całkowita';
    }
    breakdown += ` | Źródło: ${sourceText}`;

    return breakdown;
}

/**
 * Generates a PDF document for Production Work Order (karta zlecenia produkcyjnego dla pokoju produkcyjnego)
 * @param {Object} workOrderData - Work order data with items
 * @param {string} workOrderData.workOrderNumber - Work order number (e.g., 'PW-2025-0001')
 * @param {string} workOrderData.orderNumber - Source order number
 * @param {string} workOrderData.customerName - Customer name
 * @param {string} workOrderData.roomName - Production room name
 * @param {string} workOrderData.status - Work order status
 * @param {number} workOrderData.priority - Priority (1-4)
 * @param {string} workOrderData.plannedDate - Planned date
 * @param {string} workOrderData.notes - Production notes
 * @param {Array} workOrderData.items - Array of production order items
 * @returns {Promise<Buffer>} - PDF file as buffer
 */
function createProductionWorkOrderPDF(workOrderData, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 40,
                bufferPages: true
            });
            
            // Register fonts for Polish characters if available
            if (fs.existsSync(regularFontPath)) {
                doc.registerFont('NotoSans', regularFontPath);
                doc.registerFont('NotoSans-Bold', boldFontPath);
                console.log('Fonty NotoSans zarejestrowane dla PDF zlecenia produkcyjnego');
            }
            
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Document metadata
            doc.info['Title'] = `Zlecenie ${workOrderData.workOrderNumber}`;
            doc.info['Author'] = 'System zamówień - Produkcja';
            doc.info['Subject'] = 'Karta zlecenia produkcyjnego';

            // ============================================
            // HEADER - Logo area + Title
            // ============================================
            
            // Title bar with room name
            doc.rect(40, 40, 515, 50)
               .fill('#2563eb');
            
            doc.fontSize(22)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .fillColor('#ffffff')
               .text('ZLECENIE PRODUKCYJNE', 50, 52, { width: 300 });
            
            doc.fontSize(16)
               .text(workOrderData.roomName || 'Pokój produkcyjny', 350, 55, { 
                   width: 195, 
                   align: 'right' 
               });

            // ============================================
            // INFO SECTION - Order details
            // ============================================
            
            let y = 110;
            doc.fillColor('#000000');

            // Left column - Work order info
            doc.fontSize(10)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Nr zlecenia:', 40, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(workOrderData.workOrderNumber || '-', 120, y);
            
            y += 18;
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Zamówienie:', 40, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(workOrderData.orderNumber || '-', 120, y);
            
            y += 18;
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Klient:', 40, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(workOrderData.customerName || '-', 120, y, { width: 180 });

            // Right column - Status and dates
            y = 110;
            const priorityLabels = { 1: 'PILNE', 2: 'Wysoki', 3: 'Normalny', 4: 'Niski' };
            const priorityColors = { 1: '#dc2626', 2: '#f59e0b', 3: '#22c55e', 4: '#6b7280' };
            const priority = workOrderData.priority || 3;
            
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Priorytet:', 320, y);
            
            // Priority badge
            const priorityLabel = priorityLabels[priority] || 'Normalny';
            const priorityColor = priorityColors[priority] || '#22c55e';
            doc.rect(380, y - 2, 60, 16)
               .fill(priorityColor);
            doc.fontSize(9)
               .fillColor('#ffffff')
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text(priorityLabel, 382, y, { width: 56, align: 'center' });
            
            y += 18;
            doc.fillColor('#000000')
               .fontSize(10)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Data planowana:', 320, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(workOrderData.plannedDate 
                   ? new Date(workOrderData.plannedDate).toLocaleDateString('pl-PL')
                   : '-', 420, y);
            
            y += 18;
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Data wydruku:', 320, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(new Date().toLocaleString('pl-PL'), 420, y);

            // ============================================
            // ITEMS TABLE
            // ============================================
            
            y = 180;
            
            // Table header
            doc.rect(40, y, 515, 25)
               .fill('#f3f4f6');
            
            y += 7;
            doc.fillColor('#000000')
               .fontSize(9)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Lp.', 45, y, { width: 25 })
               .text('Produkt', 70, y, { width: 180 })
               .text('Lokalizacja', 255, y, { width: 100 })
               .text('Ilość', 360, y, { width: 50, align: 'right' })
               .text('Projekty', 415, y, { width: 135 });
            
            y += 23;
            
            // Table rows
            const items = workOrderData.items || [];
            doc.font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica');
            
            items.forEach((item, index) => {
                // Check if we need a new page
                if (y > 600) {
                    doc.addPage();
                    y = 50;
                }
                
                // Alternating row background (pierwszy, trzeci, itd. wiersz w jasnym szarym kolorze)
                if (index % 2 === 0) {
                    doc.rect(40, y - 5, 515, 28)
                       .fill('#fafafa');
                }
                
                // Określ źródło prawdy dla ilości
                const quantitySource = (item.quantitySource || 'total').toLowerCase();
                const isSourcePerProject = quantitySource === 'perproject' || quantitySource === 'projects';
                
                // Tekst zawsze zaczynamy w kolorze czarnym
                doc.fillColor('#000000')
                   .fontSize(9)
                   .text((index + 1).toString(), 45, y, { width: 25 })
                   .text(item.productName || item.identifier || '-', 70, y, { 
                       width: 180,
                       ellipsis: true 
                   })
                   .text(formatLocationFull(item), 255, y, { 
                       width: 100,
                       ellipsis: true 
                   });
                
                // Kolumna Ilość - pogrubiona jeśli źródło = total
                if (!isSourcePerProject) {
                    doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold');
                } else {
                    doc.font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica');
                }
                doc.text((item.quantity || 0).toString(), 360, y, { width: 50, align: 'right' });
                
                // Kolumna Projekty - pogrubiona jeśli źródło = perProject
                if (isSourcePerProject) {
                    doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold');
                } else {
                    doc.font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica');
                }
                doc.fontSize(8)
                   .text(formatProjectsShort(item) || '-', 415, y, { 
                       width: 135,
                       ellipsis: true 
                   });
                
                // Reset do normalnego fontu
                doc.font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica');
                
                // Production notes for item (if any)
                if (item.productionNotes) {
                    y += 12;
                    doc.fontSize(8)
                       .fillColor('#6b7280')
                       .text(`Uwagi: ${item.productionNotes}`, 70, y, { width: 480 });
                }
                
                // Project breakdown (if available)
                const projectBreakdown = formatProjectBreakdown(item);
                if (projectBreakdown) {
                    y += 12;
                    doc.fontSize(7)
                       .fillColor('#4b5563')
                       .text(projectBreakdown, 70, y, { width: 480 });
                }
                
                y += 20;
            });

            // ============================================
            // SUMMARY
            // ============================================
            
            y += 10;
            // Linia oddzielająca - wyrównana do szerokości tabeli (40 do 555 = 515px)
            doc.strokeColor('#d1d5db')
               .lineWidth(1)
               .moveTo(40, y)
               .lineTo(555, y)
               .stroke();
            
            y += 15;
            const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            
            doc.fillColor('#000000')
               .fontSize(11)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text(`Razem pozycji: ${items.length}`, 40, y)
               .text(`Razem sztuk: ${totalQuantity}`, 200, y);

            // ============================================
            // NOTES SECTION
            // ============================================
            
            if (workOrderData.notes) {
                y += 35;
                doc.fontSize(10)
                   .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
                   .text('Uwagi do zlecenia:', 40, y);
                
                y += 15;
                doc.font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
                   .fontSize(9)
                   .text(workOrderData.notes, 40, y, { width: 515 });
            }

            // ============================================
            // SIGNATURE SECTION
            // ============================================
            
            // Dynamiczna pozycja podpisów - minimum 40px poniżej ostatniej zawartości, ale nie niżej niż 650
            y = Math.max(y + 40, 400);
            y = Math.min(y, 650); // Nie niżej niż 650, aby zmieścić podpisy i stopkę
            
            // Signature boxes
            doc.rect(40, y, 160, 60)
               .stroke('#d1d5db');
            doc.rect(220, y, 160, 60)
               .stroke('#d1d5db');
            doc.rect(400, y, 155, 60)
               .stroke('#d1d5db');
            
            doc.fontSize(8)
               .fillColor('#6b7280')
               .text('Wydał (sprzedaż):', 45, y + 5)
               .text('Przyjął (produkcja):', 225, y + 5)
               .text('Zakończył:', 405, y + 5);
            
            doc.fontSize(7)
               .text('Data i podpis', 45, y + 45)
               .text('Data i podpis', 225, y + 45)
               .text('Data i podpis', 405, y + 45);

            // ============================================
            // FOOTER
            // ============================================
            
            // Stopka na dole strony A4 (stała pozycja)
            const footerY = 770;
            doc.fontSize(8)
               .fillColor('#9ca3af')
               .text(
                   `Wygenerowano: ${new Date().toLocaleString('pl-PL')} | ` +
                   `Zlecenie: ${workOrderData.workOrderNumber} | ` +
                   `Strona 1`,
                   40, footerY, { align: 'center', width: 515 }
               );

            doc.end();
        } catch (error) {
            console.error('Błąd podczas generowania PDF zlecenia produkcyjnego dla pokoju produkcyjnego:', error);
            reject(error);
        }
    });
}

/**
 * Generates a PDF document for Graphics Task (Karta zlecenia na projekty)
 * @param {Object} taskData - Graphics task data
 * @returns {Promise<Buffer>} - PDF file as buffer
 */
function createGraphicsTaskPDF(taskData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 40,
                bufferPages: true
            });
            
            // Register fonts for Polish characters if available
            if (fs.existsSync(regularFontPath)) {
                doc.registerFont('NotoSans', regularFontPath);
                doc.registerFont('NotoSans-Bold', boldFontPath);
            }
            
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Document metadata
            doc.info['Title'] = `Zlecenie na projekty #${taskData.id}`;
            doc.info['Author'] = 'System zamówień - Grafika';
            doc.info['Subject'] = 'Karta zlecenia na projekty';

            // ============================================
            // HEADER
            // ============================================
            
            doc.rect(40, 40, 515, 50)
               .fill('#7c3aed');
            
            doc.fontSize(22)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .fillColor('#ffffff')
               .text('ZLECENIE GRAFICZNE', 50, 52, { width: 300 });
            
            doc.fontSize(14)
               .text(`#${taskData.id || '-'}`, 350, 57, { 
                   width: 195, 
                   align: 'right' 
               });

            // ============================================
            // INFO SECTION
            // ============================================
            
            let y = 110;
            doc.fillColor('#000000');

            // Order info
            doc.fontSize(10)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Zamówienie:', 40, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(taskData.orderNumber || '-', 130, y);
            
            y += 18;
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Klient:', 40, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(taskData.customerName || '-', 130, y, { width: 200 });
            
            y += 18;
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Produkt:', 40, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(taskData.productName || '-', 130, y, { width: 200 });

            // Right column
            y = 110;
            const statusLabels = {
                'todo': 'Do zrobienia',
                'in_progress': 'W trakcie',
                'waiting_approval': 'Czeka na akceptację',
                'ready_for_production': 'Gotowe',
                'rejected': 'Odrzucone'
            };
            
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Status:', 320, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(statusLabels[taskData.status] || taskData.status || '-', 380, y);
            
            y += 18;
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Termin:', 320, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(taskData.dueDate 
                   ? new Date(taskData.dueDate).toLocaleDateString('pl-PL')
                   : '-', 380, y);
            
            y += 18;
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Przypisany:', 320, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(taskData.assignedToName || '-', 380, y);

            // ============================================
            // PROJECT DETAILS
            // ============================================
            
            y = 180;
            doc.rect(40, y, 515, 25)
               .fill('#f3f4f6');
            
            y += 7;
            doc.fillColor('#000000')
               .fontSize(11)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Szczegóły projektu', 50, y);
            
            y += 30;
            
            // Gallery context
            if (taskData.galleryContext) {
                doc.fontSize(10)
                   .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
                   .text('Kontekst galerii:', 40, y);
                y += 15;
                doc.font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
                   .fontSize(9)
                   .text(JSON.stringify(taskData.galleryContext, null, 2), 40, y, { width: 515 });
                y += 40;
            }
            
            // Files location
            doc.fontSize(10)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Lokalizacja plików:', 40, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(taskData.filesLocation || '-', 150, y, { width: 400 });
            
            y += 25;
            
            // Project numbers
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Numery projektów:', 40, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(taskData.projectNumbers 
                   ? JSON.stringify(taskData.projectNumbers) 
                   : '-', 150, y, { width: 400 });

            // ============================================
            // CHECKLIST
            // ============================================
            
            y += 40;
            doc.fontSize(11)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Checklista weryfikacji:', 40, y);
            
            y += 20;
            const checklist = taskData.checklist || {};
            const checklistItems = [
                { key: 'dataVerified', label: 'Dane zweryfikowane' },
                { key: 'quantitiesVerified', label: 'Ilości sprawdzone' },
                { key: 'layersOk', label: 'Warstwy OK' },
                { key: 'namingOk', label: 'Nazewnictwo OK' }
            ];
            
            checklistItems.forEach(item => {
                const checked = checklist[item.key] === true;
                doc.rect(40, y, 12, 12)
                   .stroke('#000000');
                if (checked) {
                    doc.fontSize(10)
                       .text('✓', 42, y);
                }
                doc.fontSize(10)
                   .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
                   .text(item.label, 60, y);
                y += 20;
            });

            // ============================================
            // SIGNATURE SECTION
            // ============================================
            
            y = 720;
            
            doc.rect(40, y, 240, 60)
               .stroke('#d1d5db');
            doc.rect(300, y, 255, 60)
               .stroke('#d1d5db');
            
            doc.fontSize(8)
               .fillColor('#6b7280')
               .text('Grafik (wykonał):', 45, y + 5)
               .text('Akceptacja (handlowiec):', 305, y + 5);
            
            doc.fontSize(7)
               .text('Data i podpis', 45, y + 45)
               .text('Data i podpis', 305, y + 45);

            // ============================================
            // FOOTER
            // ============================================
            
            doc.fontSize(8)
               .fillColor('#9ca3af')
               .text(
                   `Wygenerowano: ${new Date().toLocaleString('pl-PL')} | ` +
                   `Zadanie #${taskData.id}`,
                   40, 800, { align: 'center', width: 515 }
               );

            doc.end();
        } catch (error) {
            console.error('Błąd podczas generowania PDF zlecenia na projekty:', error);
            reject(error);
        }
    });
}

/**
 * Generates a PDF document for Packing List (Lista kompletacyjna)
 * @param {Object} packingData - Packing list data
 * @param {string} packingData.orderNumber - Order number
 * @param {string} packingData.customerName - Customer name
 * @param {string} packingData.customerAddress - Customer address
 * @param {Array} packingData.items - Array of order items with production status
 * @returns {Promise<Buffer>} - PDF file as buffer
 */
function createPackingListPDF(packingData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 40,
                bufferPages: true
            });
            
            // Register fonts for Polish characters if available
            if (fs.existsSync(regularFontPath)) {
                doc.registerFont('NotoSans', regularFontPath);
                doc.registerFont('NotoSans-Bold', boldFontPath);
            }
            
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Document metadata
            doc.info['Title'] = `Lista kompletacyjna ${packingData.orderNumber}`;
            doc.info['Author'] = 'System zamówień - Pakowanie';
            doc.info['Subject'] = 'Lista kompletacyjna zamówienia';

            // ============================================
            // HEADER
            // ============================================
            
            doc.rect(40, 40, 515, 50)
               .fill('#059669');
            
            doc.fontSize(22)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .fillColor('#ffffff')
               .text('LISTA KOMPLETACYJNA', 50, 52, { width: 350 });
            
            doc.fontSize(14)
               .text(packingData.orderNumber || '-', 400, 57, { 
                   width: 145, 
                   align: 'right' 
               });

            // ============================================
            // CUSTOMER INFO
            // ============================================
            
            let y = 110;
            doc.fillColor('#000000');

            doc.fontSize(10)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Klient:', 40, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(packingData.customerName || '-', 100, y, { width: 250 });
            
            y += 18;
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Adres:', 40, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(packingData.customerAddress || '-', 100, y, { width: 250 });

            // Right column
            y = 110;
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Data wydruku:', 350, y)
               .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica')
               .text(new Date().toLocaleString('pl-PL'), 440, y);
            
            y += 18;
            const allReady = (packingData.items || []).every(item => 
                item.productionStatus === 'completed'
            );
            doc.font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('Status:', 350, y);
            
            doc.rect(400, y - 2, 80, 16)
               .fill(allReady ? '#22c55e' : '#f59e0b');
            doc.fontSize(9)
               .fillColor('#ffffff')
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text(allReady ? 'KOMPLETNE' : 'W TRAKCIE', 402, y, { width: 76, align: 'center' });

            // ============================================
            // ITEMS TABLE
            // ============================================
            
            y = 165;
            
            // Table header
            doc.rect(40, y, 515, 25)
               .fill('#f3f4f6');
            
            y += 7;
            doc.fillColor('#000000')
               .fontSize(9)
               .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
               .text('✓', 45, y, { width: 20 })
               .text('Lp.', 65, y, { width: 25 })
               .text('Produkt', 90, y, { width: 180 })
               .text('Lokalizacja', 275, y, { width: 100 })
               .text('Ilość', 380, y, { width: 50, align: 'right' })
               .text('Status', 440, y, { width: 110 });
            
            y += 23;
            
            // Table rows
            const items = packingData.items || [];
            doc.font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica');
            
            items.forEach((item, index) => {
                if (y > 680) {
                    doc.addPage();
                    y = 50;
                }
                
                // Checkbox
                doc.rect(45, y - 2, 14, 14)
                   .stroke('#000000');
                
                // Status color
                const statusColors = {
                    'completed': '#22c55e',
                    'in_progress': '#3b82f6',
                    'planned': '#9ca3af',
                    'cancelled': '#ef4444'
                };
                const statusLabels = {
                    'completed': 'Gotowe',
                    'in_progress': 'W produkcji',
                    'planned': 'Zaplanowane',
                    'cancelled': 'Anulowane'
                };
                const statusColor = statusColors[item.productionStatus] || '#9ca3af';
                const statusLabel = statusLabels[item.productionStatus] || item.productionStatus || '-';
                
                doc.fillColor('#000000')
                   .fontSize(9)
                   .text((index + 1).toString(), 65, y, { width: 25 })
                   .text(item.productName || item.identifier || '-', 90, y, { 
                       width: 180,
                       ellipsis: true 
                   })
                   .text(item.locationName || '-', 275, y, { 
                       width: 100,
                       ellipsis: true 
                   })
                   .font(fs.existsSync(boldFontPath) ? 'NotoSans-Bold' : 'Helvetica-Bold')
                   .text((item.quantity || 0).toString(), 380, y, { width: 50, align: 'right' });
                
                // Status badge
                doc.rect(440, y - 2, 70, 14)
                   .fill(statusColor);
                doc.fontSize(8)
                   .fillColor('#ffffff')
                   .text(statusLabel, 442, y, { width: 66, align: 'center' });
                
                doc.fillColor('#000000')
                   .font(fs.existsSync(regularFontPath) ? 'NotoSans' : 'Helvetica');
                
                y += 25;
            });
            
            console.log(`[PDF] Po zakończeniu tabeli, y=${y}`);

            // ============================================
            // SUMMARY
            // ============================================
            
            y += 10;
            console.log(`[PDF] Przed summary, y=${y}`);
            doc.moveTo(40, y)
               .lineTo(555, y)
               .stroke('#e5e7eb');
            
            y += 15;
            const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const completedItems = items.filter(item => item.productionStatus === 'completed').length;
            
            doc.fillColor('#000000')
               .fontSize(11)
               .font('Helvetica-Bold')
               .text(`Pozycji: ${items.length} (gotowych: ${completedItems})`, 40, y)
               .text(`Razem sztuk: ${totalQuantity}`, 280, y);

            // ============================================
            // SIGNATURE SECTION
            // ============================================
            
            y = 720;
            
            doc.rect(40, y, 250, 60)
               .stroke('#d1d5db');
            doc.rect(305, y, 250, 60)
               .stroke('#d1d5db');
            
            doc.fontSize(8)
               .fillColor('#6b7280')
               .text('Spakował:', 45, y + 5)
               .text('Skontrolował:', 310, y + 5);
            
            doc.fontSize(7)
               .text('Data i podpis', 45, y + 45)
               .text('Data i podpis', 310, y + 45);

            // ============================================
            // FOOTER
            // ============================================
            
            doc.fontSize(8)
               .fillColor('#9ca3af')
               .text(
                   `Wygenerowano: ${new Date().toLocaleString('pl-PL')} | ` +
                   `Zlecenie: ${workOrderData.workOrderNumber}`,
                   40, 800, { align: 'center', width: 515 }
               );

            doc.end();
        } catch (error) {
            console.error('Błąd podczas generowania PDF listy kompletacyjnej:', error);
            reject(error);
        }
    });
}

module.exports = { 
    createPdf,
    createProductionWorkOrderPDF,
    createGraphicsTaskPDF,
    createPackingListPDF
};
