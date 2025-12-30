/**
 * Testy jednostkowe dla modułów zarządzania produkcją
 * Testy krytycznych funkcji biznesowych
 */

const request = require('supertest');
const app = require('../app');

// Mock danych testowych
const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'PRODUCTION_MANAGER'
};

const mockSupabase = {
    from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis()
    }))
};

// Mock middleware auth
jest.mock('../modules/auth', () => ({
    requireRole: () => (req, res, next) => {
        req.user = mockUser;
        next();
    }
}));

// Mock SSE
jest.mock('../modules/sse', () => ({
    broadcastEvent: jest.fn(),
    createSSEHandler: jest.fn()
}));

describe('Produkcja - Testy krytyczne', () => {
    beforeEach(() => {
        app.locals.supabase = mockSupabase;
        app.locals.sse = { broadcastEvent: jest.fn() };
        jest.clearAllMocks();
    });

    describe('Operator Transfer - Walidacja umiejętności', () => {
        test('powinien blokować transfer operatora bez wymaganych umiejętności', async () => {
            // Mock: operator nie ma umiejętności dla docelowego pokoju
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: { id: 'op1', name: 'Jan K' } })
                    })
                })
            });
            
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: { id: 1, name: 'UV-PRINT' } })
                    })
                })
            });
            
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({ data: [{ type: 'uv_print' }] })
                    })
                })
            });
            
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({ data: [] }) // Brak umiejętności
                    })
                })
            });
            
            const response = await request(app)
                .post('/api/production/operators/transfer')
                .send({
                    operatorId: 'op1',
                    targetRoomId: 1,
                    reason: 'Test transfer'
                });
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('nie ma wymaganych umiejętności');
        });

        test('powinien zezwolić na transfer operatora z wymaganymi umiejętnościami', async () => {
            // Mock: operator ma umiejętności
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: { id: 'op1', name: 'Jan K' } })
                    })
                })
            });
            
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: { id: 1, name: 'UV-PRINT' } })
                    })
                })
            });
            
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({ data: [{ type: 'uv_print' }] })
                    })
                })
            });
            
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({ 
                            data: [{ workCenterType: 'uv_print', level: 3 }] 
                        })
                    })
                })
            });
            
            mockSupabase.from.mockReturnValueOnce({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        is: jest.fn().mockResolvedValue({ error: null })
                    })
                })
            });
            
            mockSupabase.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ 
                            data: { id: 'assign1', operatorId: 'op1', roomId: 1 }
                        })
                    })
                })
            });
            
            const response = await request(app)
                .post('/api/production/operators/transfer')
                .send({
                    operatorId: 'op1',
                    targetRoomId: 1,
                    reason: 'Test transfer'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(app.locals.sse.broadcastEvent).toHaveBeenCalledWith({
                type: 'operator_transferred',
                data: expect.objectContaining({
                    operatorId: 'op1',
                    operatorName: 'Jan K',
                    toRoomName: 'UV-PRINT'
                })
            });
        });
    });

    describe('Material Stock - Wykrywanie braków', () => {
        test('powinien emitować SSE przy przekroczeniu progu minimalnego', async () => {
            // Mock: aktualny stan powyżej progu
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ 
                            data: { 
                                id: 'mat1', 
                                materialCode: 'MAT-001',
                                name: 'Akryl 3mm',
                                quantity: 100,
                                minThreshold: 50,
                                unit: 'szt'
                            } 
                        })
                    })
                })
            });
            
            // Mock: aktualizacja stanu poniżej progu
            mockSupabase.from.mockReturnValueOnce({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ 
                            data: { 
                                id: 'mat1', 
                                quantity: 30,
                                minThreshold: 50
                            } 
                        })
                    })
                })
            });
            
            // Mock: logowanie zmiany
            mockSupabase.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockResolvedValue({ data: null })
                })
            });
            
            const response = await request(app)
                .patch('/api/production/materials/mat1/stock')
                .send({
                    quantity: 30,
                    changeType: 'issue',
                    notes: 'Test wydania'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.data.isShortage).toBe(true);
            expect(response.body.data.shortageAmount).toBe(20);
            expect(app.locals.sse.broadcastEvent).toHaveBeenCalledWith({
                type: 'material_shortage',
                data: expect.objectContaining({
                    materialId: 'mat1',
                    materialName: 'Akryl 3mm',
                    currentQty: 30,
                    threshold: 50,
                    shortageAmount: 20
                })
            });
        });

        test('powinien blokować ujemny stan magazynowy', async () => {
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ 
                            data: { id: 'mat1', quantity: 50 }
                        })
                    })
                })
            });
            
            const response = await request(app)
                .patch('/api/production/materials/mat1/stock')
                .send({
                    quantity: -10,
                    changeType: 'issue'
                });
            
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('nie może być ujemny');
        });
    });

    describe('Machine Status - Obsługa awarii', () => {
        test('powinien aktualizować status maszyny i emitować SSE', async () => {
            // Mock: sprawdzenie maszyny
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ 
                            data: { id: 1, name: 'Laser CO2 #1', code: 'LASER-CO2-01' }
                        })
                    })
                })
            });
            
            // Mock: dodanie statusu
            mockSupabase.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ 
                            data: { id: 'status1', status: 'down' }
                        })
                    })
                })
            });
            
            // Mock: aktualizacja WorkStation
            mockSupabase.from.mockReturnValueOnce({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ error: null })
                })
            });
            
            const response = await request(app)
                .post('/api/production/machines/1/status')
                .send({
                    status: 'down',
                    statusReason: 'Awaria lasera',
                    notes: 'Wymaga serwisu'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(app.locals.sse.broadcastEvent).toHaveBeenCalledWith({
                type: 'machine_status_changed',
                data: expect.objectContaining({
                    machineId: 1,
                    machineName: 'Laser CO2 #1',
                    newStatus: 'down',
                    statusReason: 'Awaria lasera'
                })
            });
        });

        test('powinien walidować poprawność statusu', async () => {
            const response = await request(app)
                .post('/api/production/machines/1/status')
                .send({
                    status: 'invalid_status'
                });
            
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Nieprawidłowy status');
        });
    });

    describe('Dashboard - Kalkulacja ryzyk', () => {
        test('powinien poprawnie agregować ryzyka', async () => {
            // Mock: stany maszyn
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockResolvedValue({
                    data: [
                        { status: 'down', roomId: 1, roomName: 'LASER-1' },
                        { status: 'ok', roomId: 2, roomName: 'UV-PRINT' }
                    ]
                })
            });
            
            // Mock: braki materiałowe
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockResolvedValue({
                    data: [
                        { id: 'mat1', name: 'Akryl', shortageAmount: 20 },
                        { id: 'mat2', name: 'HDF', shortageAmount: 10 }
                    ]
                })
            });
            
            // Mock: zagrożone zamówienia
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        or: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [
                                    { id: 'po1', riskLevel: 'high' },
                                    { id: 'po2', riskLevel: 'critical' }
                                ]
                            })
                        })
                    })
                })
            });
            
            // Mock: KPI
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    gte: jest.fn().mockResolvedValue({
                        data: [
                            { status: 'completed', createdAt: '2025-12-26', completedAt: '2025-12-26' },
                            { status: 'completed', createdAt: '2025-12-26', completedAt: '2025-12-26' }
                        ]
                    })
                })
            });
            
            const response = await request(app)
                .get('/api/production/dashboard/executive');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.summary).toMatchObject({
                atRiskOrders: 2,
                machinesDown: 1,
                materialShortages: 2,
                activeAlerts: expect.any(Number)
            });
            expect(response.body.data.kpi).toMatchObject({
                throughputToday: expect.any(Number),
                onTimeDelivery: expect.any(Number)
            });
        });
    });

    describe('Bottlenecks - Identyfikacja zatorów', () => {
        test('powinien identyfikować pokoje z zatorami', async () => {
            // Mock: operacje w kolejce
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    in: jest.fn().mockReturnValue({
                        gte: jest.fn().mockResolvedValue({
                            data: [
                                {
                                    status: 'pending',
                                    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                                    WorkCenter: {
                                        type: 'laser_co2',
                                        ProductionRoom: {
                                            id: 1,
                                            name: 'LASER-1',
                                            code: 'LASER-1'
                                        }
                                    }
                                },
                                {
                                    status: 'pending',
                                    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
                                    WorkCenter: {
                                        type: 'laser_co2',
                                        ProductionRoom: {
                                            id: 1,
                                            name: 'LASER-1',
                                            code: 'LASER-1'
                                        }
                                    }
                                },
                                {
                                    status: 'pending',
                                    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                                    WorkCenter: {
                                        type: 'uv_print',
                                        ProductionRoom: {
                                            id: 2,
                                            name: 'UV-PRINT',
                                            code: 'UV-PRINT'
                                        }
                                    }
                                }
                            ]
                        })
                    })
                })
            });
            
            const response = await request(app)
                .get('/api/production/bottlenecks');
            
            expect(response.status).toBe(200);
            expect(response.body.data.bottlenecks).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        roomName: 'LASER-1',
                        pending: 2,
                        bottleneckScore: expect.any(Number)
                    })
                ])
            );
        });
    });
});

// Testy integracyjne
describe('Produkcja - Testy integracyjne', () => {
    test('smoke test - serwer powinien startować poprawnie', async () => {
        const response = await request(app)
            .get('/api/health');
        
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('OK');
    });

    test('endpointy powinny być dostępne z poprawnymi rolami', async () => {
        const endpoints = [
            '/api/production/machines/status',
            '/api/production/materials/stock',
            '/api/production/operators/assignments',
            '/api/production/dashboard/executive'
        ];
        
        for (const endpoint of endpoints) {
            const response = await request(app)
                .get(endpoint);
            
            // Nie powinien zwracać 404 (endpoint nieistniejący)
            expect(response.status).not.toBe(404);
        }
    });
});

// Testy współbieżności
describe('Produkcja - Testy współbieżności', () => {
    test('transfer operatora powinien być atomowy', async () => {
        // TODO: Implementuj test sprawdzający, że dwa jednoczesne transfery
        // tego samego operatora nie powodują niespójności
    });

    test('aktualizacja stanu magazynowego powinna być thread-safe', async () => {
        // TODO: Implementuj test sprawdzający wyścigi przy aktualizacji stanu
    });
});
