/**
 * Testy jednostkowe dla funkcji computeOrderTimePriority
 * Algorytm auto-priorytetu zamówień produkcyjnych
 * Zgodnie z docs/SPEC_PRODUCTION_PANEL.md §6.6
 */

const { computeOrderTimePriority } = require('./server.js');

describe('computeOrderTimePriority', () => {
    // Stała data "teraz" dla powtarzalności testów
    const NOW = new Date('2025-12-10T12:00:00Z');

    describe('Obsługa brakujących danych', () => {
        test('zwraca UNKNOWN gdy brak deliveryDate', () => {
            const result = computeOrderTimePriority({ deliveryDate: null, now: NOW });
            expect(result.timeStatus).toBe('UNKNOWN');
            expect(result.priority).toBe(3);
            expect(result.timeToDeadlineMinutes).toBeNull();
        });

        test('zwraca UNKNOWN gdy deliveryDate jest undefined', () => {
            const result = computeOrderTimePriority({ now: NOW });
            expect(result.timeStatus).toBe('UNKNOWN');
            expect(result.priority).toBe(3);
        });

        test('zwraca UNKNOWN gdy deliveryDate ma nieprawidłowy format', () => {
            const result = computeOrderTimePriority({ deliveryDate: 'invalid-date', now: NOW });
            expect(result.timeStatus).toBe('UNKNOWN');
            expect(result.priority).toBe(3);
        });
    });

    describe('Status OVERDUE (przeterminowane)', () => {
        test('zwraca OVERDUE gdy termin minął', () => {
            const deliveryDate = new Date('2025-12-09T12:00:00Z'); // wczoraj
            const result = computeOrderTimePriority({ deliveryDate, now: NOW });
            
            expect(result.timeStatus).toBe('OVERDUE');
            expect(result.priority).toBe(1); // urgent
            expect(result.timeToDeadlineMinutes).toBeLessThan(0);
        });

        test('zwraca OVERDUE gdy termin minął o kilka dni', () => {
            const deliveryDate = new Date('2025-12-05T12:00:00Z'); // 5 dni temu
            const result = computeOrderTimePriority({ deliveryDate, now: NOW });
            
            expect(result.timeStatus).toBe('OVERDUE');
            expect(result.priority).toBe(1);
        });
    });

    describe('Status AT_RISK (zagrożone)', () => {
        test('zwraca AT_RISK gdy do terminu < 24h', () => {
            const deliveryDate = new Date('2025-12-11T10:00:00Z'); // za 22h
            const result = computeOrderTimePriority({ deliveryDate, now: NOW });
            
            expect(result.timeStatus).toBe('AT_RISK');
            expect(result.timeToDeadlineMinutes).toBeLessThanOrEqual(24 * 60);
        });

        test('zwraca AT_RISK gdy slack <= 0 (nie zdążymy)', () => {
            const deliveryDate = new Date('2025-12-11T14:00:00Z'); // za 26h
            const estimatedTimeMinutes = 30 * 60; // 30h pracy
            const result = computeOrderTimePriority({ deliveryDate, estimatedTimeMinutes, now: NOW });
            
            expect(result.timeStatus).toBe('AT_RISK');
            expect(result.slackMinutes).toBeLessThanOrEqual(0);
        });

        test('zwraca priority=2 gdy AT_RISK i do terminu < 4h', () => {
            const deliveryDate = new Date('2025-12-10T15:00:00Z'); // za 3h
            const result = computeOrderTimePriority({ deliveryDate, now: NOW });
            
            expect(result.timeStatus).toBe('AT_RISK');
            expect(result.priority).toBe(2); // high
        });
    });

    describe('Status ON_TIME (na czas)', () => {
        test('zwraca ON_TIME gdy dużo czasu do terminu', () => {
            const deliveryDate = new Date('2025-12-15T12:00:00Z'); // za 5 dni
            const result = computeOrderTimePriority({ deliveryDate, now: NOW });
            
            expect(result.timeStatus).toBe('ON_TIME');
            expect(result.timeToDeadlineMinutes).toBeGreaterThan(24 * 60);
        });

        test('zwraca priority=3 (normal) dla standardowego ON_TIME', () => {
            const deliveryDate = new Date('2025-12-12T12:00:00Z'); // za 2 dni
            const estimatedTimeMinutes = 60; // 1h pracy
            const result = computeOrderTimePriority({ deliveryDate, estimatedTimeMinutes, now: NOW });
            
            expect(result.timeStatus).toBe('ON_TIME');
            expect(result.priority).toBe(3); // normal
        });

        test('zwraca priority=4 (low) gdy > 72h do terminu i dużo slacku', () => {
            const deliveryDate = new Date('2025-12-20T12:00:00Z'); // za 10 dni
            const estimatedTimeMinutes = 60; // 1h pracy
            const result = computeOrderTimePriority({ deliveryDate, estimatedTimeMinutes, now: NOW });
            
            expect(result.timeStatus).toBe('ON_TIME');
            expect(result.priority).toBe(4); // low
            expect(result.timeToDeadlineMinutes).toBeGreaterThan(72 * 60);
        });
    });

    describe('Obliczenia czasowe', () => {
        test('poprawnie oblicza timeToDeadlineMinutes', () => {
            const deliveryDate = new Date('2025-12-10T14:00:00Z'); // za 2h
            const result = computeOrderTimePriority({ deliveryDate, now: NOW });
            
            expect(result.timeToDeadlineMinutes).toBe(120); // 2h = 120 min
        });

        test('poprawnie oblicza slackMinutes', () => {
            const deliveryDate = new Date('2025-12-10T14:00:00Z'); // za 2h
            const estimatedTimeMinutes = 60; // 1h pracy
            const result = computeOrderTimePriority({ deliveryDate, estimatedTimeMinutes, now: NOW });
            
            expect(result.timeToDeadlineMinutes).toBe(120);
            expect(result.slackMinutes).toBe(60); // 120 - 60 = 60 min zapasu
        });

        test('slackMinutes może być ujemny', () => {
            const deliveryDate = new Date('2025-12-10T13:00:00Z'); // za 1h
            const estimatedTimeMinutes = 120; // 2h pracy
            const result = computeOrderTimePriority({ deliveryDate, estimatedTimeMinutes, now: NOW });
            
            expect(result.timeToDeadlineMinutes).toBe(60);
            expect(result.slackMinutes).toBe(-60); // 60 - 120 = -60 min (nie zdążymy)
        });
    });

    describe('Obsługa różnych formatów daty', () => {
        test('akceptuje string ISO', () => {
            const result = computeOrderTimePriority({ 
                deliveryDate: '2025-12-15T12:00:00Z', 
                now: NOW 
            });
            expect(result.timeStatus).toBe('ON_TIME');
        });

        test('akceptuje obiekt Date', () => {
            const result = computeOrderTimePriority({ 
                deliveryDate: new Date('2025-12-15T12:00:00Z'), 
                now: NOW 
            });
            expect(result.timeStatus).toBe('ON_TIME');
        });

        test('akceptuje timestamp', () => {
            const timestamp = new Date('2025-12-15T12:00:00Z').getTime();
            const result = computeOrderTimePriority({ 
                deliveryDate: timestamp, 
                now: NOW 
            });
            expect(result.timeStatus).toBe('ON_TIME');
        });
    });
});
