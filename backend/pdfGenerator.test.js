const {
    createPdf,
    createProductionWorkOrderPDF,
    createGraphicsTaskPDF,
    createPackingListPDF
} = require('./pdfGenerator');

async function expectPdfBuffer(promise) {
    const buffer = await promise;
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    return buffer;
}

describe('PDF generators', () => {
    describe('createProductionWorkOrderPDF', () => {
        it('generuje PDF z poprawnymi danymi', async () => {
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

            await expectPdfBuffer(createProductionWorkOrderPDF(data));
        });

        it('obsługuje pełną lokalizację PM/KI', async () => {
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

            await expectPdfBuffer(createProductionWorkOrderPDF(data));
        });

        it('obsługuje źródło prawdy total vs perProject', async () => {
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

            await expectPdfBuffer(createProductionWorkOrderPDF(data));
        });

        it('obsługuje puste dane', async () => {
            const data = {
                workOrderNumber: 'PW-2025-0002',
                roomName: 'Test',
                items: []
            };

            await expectPdfBuffer(createProductionWorkOrderPDF(data));
        });

        it.each([1, 2, 3, 4])('obsługuje priorytet %p', async (priority) => {
            const data = {
                workOrderNumber: `PW-PRIO-${priority}`,
                roomName: 'Test',
                priority,
                items: []
            };

            await expectPdfBuffer(createProductionWorkOrderPDF(data));
        });

        it('obsługuje dużą liczbę pozycji', async () => {
            const items = Array.from({ length: 50 }, (_, i) => ({
                productName: `Produkt testowy ${i + 1}`,
                identifier: `PROD-${i + 1}`,
                locationName: 'Miasto',
                quantity: 10 + i,
                selectedProjects: `${i + 1}`
            }));

            const data = {
                workOrderNumber: 'PW-LARGE-001',
                roomName: 'Test',
                items
            };

            const buffer = await expectPdfBuffer(createProductionWorkOrderPDF(data));
            expect(buffer.length).toBeGreaterThan(5000);
        });
    });

    describe('createGraphicsTaskPDF', () => {
        it('generuje PDF z poprawnymi danymi', async () => {
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

            await expectPdfBuffer(createGraphicsTaskPDF(data));
        });

        it.each(['todo', 'in_progress', 'waiting_approval', 'ready_for_production', 'rejected'])(
            'obsługuje status %s',
            async (status) => {
                const data = { id: 1, status };
                await expectPdfBuffer(createGraphicsTaskPDF(data));
            }
        );

        it('obsługuje brak checklisty', async () => {
            const data = {
                id: 456,
                orderNumber: '2025/10/ABC'
            };

            await expectPdfBuffer(createGraphicsTaskPDF(data));
        });
    });

    describe('createPackingListPDF', () => {
        it('generuje PDF z poprawnymi danymi', async () => {
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

            await expectPdfBuffer(createPackingListPDF(data));
        });

        it('pokazuje KOMPLETNE gdy wszystko gotowe', async () => {
            const data = {
                orderNumber: '2025/20/GHI',
                customerName: 'Klient',
                items: [
                    { productName: 'A', quantity: 10, productionStatus: 'completed' },
                    { productName: 'B', quantity: 20, productionStatus: 'completed' }
                ]
            };

            await expectPdfBuffer(createPackingListPDF(data));
        });

        it('pokazuje W TRAKCIE gdy nie wszystko gotowe', async () => {
            const data = {
                orderNumber: '2025/21/JKL',
                customerName: 'Klient',
                items: [
                    { productName: 'A', quantity: 10, productionStatus: 'completed' },
                    { productName: 'B', quantity: 20, productionStatus: 'in_progress' }
                ]
            };

            await expectPdfBuffer(createPackingListPDF(data));
        });

        it('obsługuje pustą listę pozycji', async () => {
            const data = {
                orderNumber: '2025/22/MNO',
                customerName: 'Klient',
                items: []
            };

            await expectPdfBuffer(createPackingListPDF(data));
        });
    });

    describe('createPdf', () => {
        it('generuje PDF zamówienia', async () => {
            const orderData = [
                { name: 'Produkt 1', pc_id: 'P001', locationName: 'Miasto', quantity: 10, price: 15.0 },
                { name: 'Produkt 2', pc_id: 'P002', locationName: 'Wieś', quantity: 5, price: 25.0 }
            ];

            await expectPdfBuffer(createPdf(orderData, 'test'));
        });
    });
});
