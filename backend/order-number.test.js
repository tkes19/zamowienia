const { computeNextOrderNumber } = require('./services/orderService');

describe('computeNextOrderNumber', () => {
    test('returns year/1/shortCode when there are no existing numbers', () => {
        const result = computeNextOrderNumber({
            year: 2026,
            shortCode: 'JDO',
            existingOrderNumbers: []
        });

        expect(result).toBe('2026/1/JDO');
    });

    test('returns max+1 for a given year', () => {
        const result = computeNextOrderNumber({
            year: 2025,
            shortCode: 'ATU',
            existingOrderNumbers: [
                '2025/14/JDO',
                '2025/13/MŁU',
                '2025/99/ATU',
                'TEST-1765437296439',
                null,
                undefined,
                123
            ]
        });

        expect(result).toBe('2025/100/ATU');
    });

    test('ignores other years', () => {
        const result = computeNextOrderNumber({
            year: 2025,
            shortCode: 'JDO',
            existingOrderNumbers: [
                '2024/250/JDO',
                '2026/10/JDO',
                '2025/2/JDO'
            ]
        });

        expect(result).toBe('2025/3/JDO');
    });

    test('handles malformed strings without throwing', () => {
        const result = computeNextOrderNumber({
            year: 2025,
            shortCode: 'JDO',
            existingOrderNumbers: [
                '2025/',
                '2025/x/JDO',
                '2025/001/JDO',
                '2025/10',
                '2025/9/JDO'
            ]
        });

        expect(result).toBe('2025/11/JDO');
    });
});
