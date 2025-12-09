/**
 * Testy jednostkowe dla generatorów PDF
 * Uruchomienie: node backend/pdfGenerator.test.js
 */

const { 
    createPdf,
    createProductionWorkOrderPDF,
    createGraphicsTaskPDF,
    createPackingListPDF
} = require('./pdfGenerator');

// Kolory do konsoli
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

function log(type, message) {
    const prefix = {
        pass: `${colors.green}✓${colors.reset}`,
        fail: `${colors.red}✗${colors.reset}`,
        info: `${colors.yellow}ℹ${colors.reset}`
    };
    console.log(`${prefix[type] || ''} ${message}`);
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        passed++;
        log('pass', name);
    } catch (error) {
        failed++;
        log('fail', `${name}: ${error.message}`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// ============================================
// TESTY
// ============================================

async function runTests() {
    console.log('\n📄 Testy generatorów PDF\n');
    console.log('='.repeat(50));

    // ----------------------------------------
    // createProductionWorkOrderPDF
    // ----------------------------------------
    
    await test('createProductionWorkOrderPDF - generuje PDF z poprawnymi danymi', async () => {
        const data = {
            workOrderNumber: 'PW-2025-0001',
            orderNumber: '2025/1/ABC',
            customerName: 'Test Klient Sp. z o.o.',
            roomName: 'Laser CO2',
            status: 'planned',
            priority: 1,
            plannedDate: '2025-12-15',
            notes: 'Uwagi testowe do zlecenia',
            items: [
                {
                    productName: 'Magnes na lodówkę',
                    identifier: 'MAG-001',
                    locationName: 'Zakopane',
                    source: 'MIEJSCOWOSCI',
                    quantity: 100,
                    selectedProjects: '1,2,3',
                    projectQuantities: '30,30,40',
                    quantitySource: 'total',
                    productionNotes: 'Pakować po 10 szt.'
                },
                {
                    productName: 'Brelok drewniany',
                    identifier: 'BRE-002',
                    locationName: 'Kraków',
                    source: 'MIEJSCOWOSCI',
                    quantity: 50,
                    selectedProjects: '4,5',
                    projectQuantities: '25,25',
                    quantitySource: 'perProject'
                }
            ]
        };
        
        const buffer = await createProductionWorkOrderPDF(data);
        
        assert(buffer instanceof Buffer, 'Wynik powinien być Buffer');
        assert(buffer.length > 0, 'Buffer nie powinien być pusty');
        assert(buffer.slice(0, 5).toString() === '%PDF-', 'Powinien zaczynać się od %PDF-');
    });

    await test('createProductionWorkOrderPDF - obsługuje pełną lokalizację PM/KI', async () => {
        const data = {
            workOrderNumber: 'PW-2025-LOC',
            roomName: 'Test',
            items: [
                {
                    productName: 'Produkt PM',
                    locationName: 'Kołobrzeg',
                    source: 'MIEJSCOWOSCI',
                    quantity: 60,
                    selectedProjects: '1,2,3',
                    projectQuantities: JSON.stringify([
                        { projectNo: 1, qty: 20 },
                        { projectNo: 2, qty: 20 },
                        { projectNo: 3, qty: 20 }
                    ]),
                    quantitySource: 'perProject'
                },
                {
                    productName: 'Produkt KI',
                    locationName: 'Arka Medical SPA2',
                    source: 'KATALOG_INDYWIDUALNY',
                    quantity: 80,
                    selectedProjects: '1,2,3,4',
                    projectQuantities: JSON.stringify([
                        { projectNo: 1, qty: 20 },
                        { projectNo: 2, qty: 20 },
                        { projectNo: 3, qty: 20 },
                        { projectNo: 4, qty: 20 }
                    ]),
                    quantitySource: 'total'
                }
            ]
        };
        
        const buffer = await createProductionWorkOrderPDF(data);
        
        assert(buffer instanceof Buffer, 'Wynik powinien być Buffer');
        assert(buffer.length > 0, 'Buffer nie powinien być pusty');
    });

    await test('createProductionWorkOrderPDF - obsługuje źródło prawdy total vs perProject', async () => {
        const data = {
            workOrderNumber: 'PW-2025-SRC',
            roomName: 'Test',
            items: [
                {
                    productName: 'Źródło: total',
                    locationName: 'Miasto',
                    source: 'MIEJSCOWOSCI',
                    quantity: 100,
                    selectedProjects: '1,2',
                    projectQuantities: JSON.stringify([
                        { projectNo: 1, qty: 50 },
                        { projectNo: 2, qty: 50 }
                    ]),
                    quantitySource: 'total'
                },
                {
                    productName: 'Źródło: perProject',
                    locationName: 'Obiekt',
                    source: 'KLIENCI_INDYWIDUALNI',
                    quantity: 100,
                    selectedProjects: '1,2',
                    projectQuantities: JSON.stringify([
                        { projectNo: 1, qty: 50 },
                        { projectNo: 2, qty: 50 }
                    ]),
                    quantitySource: 'perProject'
                }
            ]
        };
        
        const buffer = await createProductionWorkOrderPDF(data);
        
        assert(buffer instanceof Buffer, 'Wynik powinien być Buffer');
        assert(buffer.length > 0, 'Buffer nie powinien być pusty');
    });

    await test('createProductionWorkOrderPDF - obsługuje puste dane', async () => {
        const data = {
            workOrderNumber: 'PW-2025-0002',
            roomName: 'Test',
            items: []
        };
        
        const buffer = await createProductionWorkOrderPDF(data);
        
        assert(buffer instanceof Buffer, 'Wynik powinien być Buffer');
        assert(buffer.length > 0, 'Buffer nie powinien być pusty');
    });

    await test('createProductionWorkOrderPDF - obsługuje wszystkie priorytety', async () => {
        for (const priority of [1, 2, 3, 4]) {
            const data = {
                workOrderNumber: `PW-PRIO-${priority}`,
                roomName: 'Test',
                priority,
                items: []
            };
            
            const buffer = await createProductionWorkOrderPDF(data);
            assert(buffer instanceof Buffer, `Priorytet ${priority} powinien działać`);
        }
    });

    await test('createProductionWorkOrderPDF - obsługuje dużą liczbę pozycji', async () => {
        const items = [];
        for (let i = 0; i < 50; i++) {
            items.push({
                productName: `Produkt testowy ${i + 1}`,
                identifier: `PROD-${i + 1}`,
                locationName: 'Miasto',
                quantity: 10 + i,
                selectedProjects: `${i + 1}`
            });
        }
        
        const data = {
            workOrderNumber: 'PW-LARGE-001',
            roomName: 'Test',
            items
        };
        
        const buffer = await createProductionWorkOrderPDF(data);
        
        assert(buffer instanceof Buffer, 'Wynik powinien być Buffer');
        assert(buffer.length > 5000, 'PDF z wieloma pozycjami powinien być większy');
    });

    // ----------------------------------------
    // createGraphicsTaskPDF
    // ----------------------------------------

    await test('createGraphicsTaskPDF - generuje PDF z poprawnymi danymi', async () => {
        const data = {
            id: 123,
            orderNumber: '2025/5/XYZ',
            customerName: 'Klient Graficzny',
            productName: 'Kubek ceramiczny',
            status: 'in_progress',
            dueDate: '2025-12-20',
            assignedToName: 'Jan Kowalski',
            galleryContext: { mode: 'PM', city: 'Warszawa' },
            filesLocation: '/qnap/projekty/2025/kubki/',
            projectNumbers: { front: 'PM-WAR-001', back: 'PM-WAR-001-B' },
            checklist: {
                dataVerified: true,
                quantitiesVerified: true,
                layersOk: false,
                namingOk: true
            }
        };
        
        const buffer = await createGraphicsTaskPDF(data);
        
        assert(buffer instanceof Buffer, 'Wynik powinien być Buffer');
        assert(buffer.length > 0, 'Buffer nie powinien być pusty');
        assert(buffer.slice(0, 5).toString() === '%PDF-', 'Powinien zaczynać się od %PDF-');
    });

    await test('createGraphicsTaskPDF - obsługuje wszystkie statusy', async () => {
        const statuses = ['todo', 'in_progress', 'waiting_approval', 'ready_for_production', 'rejected'];
        
        for (const status of statuses) {
            const data = { id: 1, status };
            const buffer = await createGraphicsTaskPDF(data);
            assert(buffer instanceof Buffer, `Status ${status} powinien działać`);
        }
    });

    await test('createGraphicsTaskPDF - obsługuje brak checklisty', async () => {
        const data = {
            id: 456,
            orderNumber: '2025/10/ABC'
        };
        
        const buffer = await createGraphicsTaskPDF(data);
        
        assert(buffer instanceof Buffer, 'Wynik powinien być Buffer');
    });

    // ----------------------------------------
    // createPackingListPDF
    // ----------------------------------------

    await test('createPackingListPDF - generuje PDF z poprawnymi danymi', async () => {
        const data = {
            orderNumber: '2025/15/DEF',
            customerName: 'Sklep Pamiątkowy',
            customerAddress: 'ul. Testowa 123, 00-001 Warszawa',
            items: [
                {
                    productName: 'Magnes',
                    identifier: 'MAG-100',
                    locationName: 'Gdańsk',
                    quantity: 200,
                    productionStatus: 'completed'
                },
                {
                    productName: 'Brelok',
                    identifier: 'BRE-200',
                    locationName: 'Sopot',
                    quantity: 100,
                    productionStatus: 'in_progress'
                },
                {
                    productName: 'Kubek',
                    identifier: 'KUB-300',
                    locationName: 'Gdynia',
                    quantity: 50,
                    productionStatus: 'planned'
                }
            ]
        };
        
        const buffer = await createPackingListPDF(data);
        
        assert(buffer instanceof Buffer, 'Wynik powinien być Buffer');
        assert(buffer.length > 0, 'Buffer nie powinien być pusty');
        assert(buffer.slice(0, 5).toString() === '%PDF-', 'Powinien zaczynać się od %PDF-');
    });

    await test('createPackingListPDF - pokazuje KOMPLETNE gdy wszystko gotowe', async () => {
        const data = {
            orderNumber: '2025/20/GHI',
            customerName: 'Klient',
            items: [
                { productName: 'A', quantity: 10, productionStatus: 'completed' },
                { productName: 'B', quantity: 20, productionStatus: 'completed' }
            ]
        };
        
        const buffer = await createPackingListPDF(data);
        
        assert(buffer instanceof Buffer, 'Wynik powinien być Buffer');
    });

    await test('createPackingListPDF - pokazuje W TRAKCIE gdy nie wszystko gotowe', async () => {
        const data = {
            orderNumber: '2025/21/JKL',
            customerName: 'Klient',
            items: [
                { productName: 'A', quantity: 10, productionStatus: 'completed' },
                { productName: 'B', quantity: 20, productionStatus: 'in_progress' }
            ]
        };
        
        const buffer = await createPackingListPDF(data);
        
        assert(buffer instanceof Buffer, 'Wynik powinien być Buffer');
    });

    await test('createPackingListPDF - obsługuje pustą listę pozycji', async () => {
        const data = {
            orderNumber: '2025/22/MNO',
            customerName: 'Klient',
            items: []
        };
        
        const buffer = await createPackingListPDF(data);
        
        assert(buffer instanceof Buffer, 'Wynik powinien być Buffer');
    });

    // ----------------------------------------
    // createPdf (istniejąca funkcja)
    // ----------------------------------------

    await test('createPdf - generuje PDF zamówienia', async () => {
        const orderData = [
            { name: 'Produkt 1', pc_id: 'P001', locationName: 'Miasto', quantity: 10, price: 15.00 },
            { name: 'Produkt 2', pc_id: 'P002', locationName: 'Wieś', quantity: 5, price: 25.00 }
        ];
        
        const buffer = await createPdf(orderData, 'test');
        
        assert(buffer instanceof Buffer, 'Wynik powinien być Buffer');
        assert(buffer.length > 0, 'Buffer nie powinien być pusty');
    });

    // ----------------------------------------
    // PODSUMOWANIE
    // ----------------------------------------

    console.log('\n' + '='.repeat(50));
    console.log(`\nWyniki: ${colors.green}${passed} passed${colors.reset}, ${colors.red}${failed} failed${colors.reset}`);
    
    if (failed > 0) {
        process.exit(1);
    }
}

// Uruchom testy
runTests().catch(error => {
    console.error('Błąd podczas uruchamiania testów:', error);
    process.exit(1);
});
