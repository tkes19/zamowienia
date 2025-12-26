/**
 * Testy jednostkowe dla serwisów
 */

const orderService = require('../services/orderService');
const productionService = require('../services/productionService');

describe('OrderService', () => {
  describe('normalizeText', () => {
    it('should convert Polish characters to ASCII', () => {
      const input = 'Łódź Kraków Gdańsk';
      const result = orderService.normalizeText(input);
      expect(result).toBe('LODZ KRAKOW GDANSK');
    });

    it('should handle empty string', () => {
      expect(orderService.normalizeText('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(orderService.normalizeText(null)).toBe('');
      expect(orderService.normalizeText(undefined)).toBe('');
    });
  });

  describe('computeNextOrderNumber', () => {
    it('should generate first order number for year', () => {
      const result = orderService.computeNextOrderNumber({
        year: 2025,
        shortCode: 'ABC',
        existingOrderNumbers: []
      });
      expect(result).toBe('2025/1/ABC');
    });

    it('should increment sequence correctly', () => {
      const result = orderService.computeNextOrderNumber({
        year: 2025,
        shortCode: 'ABC',
        existingOrderNumbers: ['2025/1/ABC', '2025/2/XYZ', '2025/3/ABC']
      });
      expect(result).toBe('2025/4/ABC');
    });

    it('should ignore orders from different years', () => {
      const result = orderService.computeNextOrderNumber({
        year: 2025,
        shortCode: 'ABC',
        existingOrderNumbers: ['2024/100/ABC', '2025/1/ABC', '2026/50/ABC']
      });
      expect(result).toBe('2025/2/ABC');
    });

    it('should handle malformed order numbers', () => {
      const result = orderService.computeNextOrderNumber({
        year: 2025,
        shortCode: 'ABC',
        existingOrderNumbers: ['2025/1/ABC', 'invalid', null, '2025/2/ABC']
      });
      expect(result).toBe('2025/3/ABC');
    });
  });

  describe('validateOrderItem', () => {
    it('should pass validation for valid item', () => {
      const item = {
        productId: 'prod-123',
        quantity: 10,
        unitPrice: 25.50
      };
      const errors = orderService.validateOrderItem(item);
      expect(errors).toHaveLength(0);
    });

    it('should fail when productId is missing', () => {
      const item = {
        quantity: 10,
        unitPrice: 25.50
      };
      const errors = orderService.validateOrderItem(item);
      expect(errors).toContain('Brak productId');
    });

    it('should fail when quantity is invalid', () => {
      const item = {
        productId: 'prod-123',
        quantity: 0,
        unitPrice: 25.50
      };
      const errors = orderService.validateOrderItem(item);
      expect(errors).toContain('Nieprawidłowa ilość');
    });

    it('should fail when unitPrice is negative', () => {
      const item = {
        productId: 'prod-123',
        quantity: 10,
        unitPrice: -5
      };
      const errors = orderService.validateOrderItem(item);
      expect(errors).toContain('Nieprawidłowa cena jednostkowa');
    });
  });

  describe('validateOrderData', () => {
    it('should pass validation for valid order', () => {
      const orderData = {
        customerId: 'cust-123',
        items: [
          { productId: 'prod-1', quantity: 5, unitPrice: 10 },
          { productId: 'prod-2', quantity: 3, unitPrice: 20 }
        ]
      };
      const errors = orderService.validateOrderData(orderData);
      expect(errors).toHaveLength(0);
    });

    it('should fail when customerId is missing', () => {
      const orderData = {
        items: [{ productId: 'prod-1', quantity: 5, unitPrice: 10 }]
      };
      const errors = orderService.validateOrderData(orderData);
      expect(errors).toContain('Brak customerId');
    });

    it('should fail when items array is empty', () => {
      const orderData = {
        customerId: 'cust-123',
        items: []
      };
      const errors = orderService.validateOrderData(orderData);
      expect(errors).toContain('Zamówienie musi zawierać przynajmniej jedną pozycję');
    });

    it('should report errors for invalid items', () => {
      const orderData = {
        customerId: 'cust-123',
        items: [
          { productId: 'prod-1', quantity: 0, unitPrice: 10 },
          { quantity: 5, unitPrice: -10 }
        ]
      };
      const errors = orderService.validateOrderData(orderData);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Pozycja 1'))).toBe(true);
      expect(errors.some(e => e.includes('Pozycja 2'))).toBe(true);
    });
  });

  describe('calculateOrderTotal', () => {
    it('should calculate total correctly', () => {
      const items = [
        { quantity: 5, unitPrice: 10 },
        { quantity: 3, unitPrice: 20 },
        { quantity: 2, unitPrice: 15 }
      ];
      const total = orderService.calculateOrderTotal(items);
      expect(total).toBe(140); // 50 + 60 + 30
    });

    it('should handle empty items array', () => {
      const total = orderService.calculateOrderTotal([]);
      expect(total).toBe(0);
    });
  });

  describe('canEditOrder', () => {
    const order = { userId: 'user-123' };

    it('should allow ADMIN to edit any order', () => {
      expect(orderService.canEditOrder(order, 'other-user', 'ADMIN')).toBe(true);
    });

    it('should allow SALES_DEPT to edit any order', () => {
      expect(orderService.canEditOrder(order, 'other-user', 'SALES_DEPT')).toBe(true);
    });

    it('should allow SALES_REP to edit own order', () => {
      expect(orderService.canEditOrder(order, 'user-123', 'SALES_REP')).toBe(true);
    });

    it('should not allow SALES_REP to edit other orders', () => {
      expect(orderService.canEditOrder(order, 'other-user', 'SALES_REP')).toBe(false);
    });

    it('should not allow WAREHOUSE to edit orders', () => {
      expect(orderService.canEditOrder(order, 'user-123', 'WAREHOUSE')).toBe(false);
    });
  });

  describe('canViewOrder', () => {
    const order = { userId: 'user-123' };

    it('should allow ADMIN to view any order', () => {
      expect(orderService.canViewOrder(order, 'other-user', 'ADMIN')).toBe(true);
    });

    it('should allow WAREHOUSE to view any order', () => {
      expect(orderService.canViewOrder(order, 'other-user', 'WAREHOUSE')).toBe(true);
    });

    it('should allow PRODUCTION to view any order', () => {
      expect(orderService.canViewOrder(order, 'other-user', 'PRODUCTION')).toBe(true);
    });

    it('should allow SALES_REP to view own order', () => {
      expect(orderService.canViewOrder(order, 'user-123', 'SALES_REP')).toBe(true);
    });

    it('should not allow SALES_REP to view other orders', () => {
      expect(orderService.canViewOrder(order, 'other-user', 'SALES_REP')).toBe(false);
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow PENDING -> APPROVED', () => {
      expect(orderService.validateStatusTransition('PENDING', 'APPROVED')).toBe(true);
    });

    it('should allow PENDING -> CANCELLED', () => {
      expect(orderService.validateStatusTransition('PENDING', 'CANCELLED')).toBe(true);
    });

    it('should not allow PENDING -> SHIPPED', () => {
      expect(orderService.validateStatusTransition('PENDING', 'SHIPPED')).toBe(false);
    });

    it('should allow APPROVED -> IN_PRODUCTION', () => {
      expect(orderService.validateStatusTransition('APPROVED', 'IN_PRODUCTION')).toBe(true);
    });

    it('should not allow DELIVERED -> any status', () => {
      expect(orderService.validateStatusTransition('DELIVERED', 'PENDING')).toBe(false);
      expect(orderService.validateStatusTransition('DELIVERED', 'CANCELLED')).toBe(false);
    });

    it('should not allow CANCELLED -> any status', () => {
      expect(orderService.validateStatusTransition('CANCELLED', 'PENDING')).toBe(false);
      expect(orderService.validateStatusTransition('CANCELLED', 'APPROVED')).toBe(false);
    });
  });
});

describe('ProductionService', () => {
  describe('parseProductionPathExpression', () => {
    it('should parse single path', () => {
      const result = productionService.parseProductionPathExpression('PATH1');
      expect(result).toEqual({
        branches: [{ pathCodes: ['PATH1'] }]
      });
    });

    it('should parse multiple paths in single branch', () => {
      const result = productionService.parseProductionPathExpression('PATH1+PATH2+PATH3');
      expect(result).toEqual({
        branches: [{ pathCodes: ['PATH1', 'PATH2', 'PATH3'] }]
      });
    });

    it('should parse multiple branches', () => {
      const result = productionService.parseProductionPathExpression('PATH1+PATH2|PATH3+PATH4');
      expect(result).toEqual({
        branches: [
          { pathCodes: ['PATH1', 'PATH2'] },
          { pathCodes: ['PATH3', 'PATH4'] }
        ]
      });
    });

    it('should handle empty string', () => {
      expect(productionService.parseProductionPathExpression('')).toBe(null);
    });

    it('should handle null/undefined', () => {
      expect(productionService.parseProductionPathExpression(null)).toBe(null);
      expect(productionService.parseProductionPathExpression(undefined)).toBe(null);
    });

    it('should trim whitespace', () => {
      const result = productionService.parseProductionPathExpression('  PATH1 + PATH2  |  PATH3  ');
      expect(result).toEqual({
        branches: [
          { pathCodes: ['PATH1', 'PATH2'] },
          { pathCodes: ['PATH3'] }
        ]
      });
    });
  });

  describe('normalizeProjectViewUrl', () => {
    it('should return null for empty string', () => {
      expect(productionService.normalizeProjectViewUrl('')).toBe('');
    });

    it('should return null for "/"', () => {
      expect(productionService.normalizeProjectViewUrl('/')).toBe(null);
    });

    it('should normalize absolute URL to relative', () => {
      const input = 'http://localhost:3001/api/gallery/image?url=test.jpg';
      const result = productionService.normalizeProjectViewUrl(input);
      expect(result).toBe('/api/gallery/image?url=test.jpg');
    });

    it('should keep relative URL unchanged', () => {
      const input = '/api/gallery/image?url=test.jpg';
      const result = productionService.normalizeProjectViewUrl(input);
      expect(result).toBe('/api/gallery/image?url=test.jpg');
    });

    it('should add leading slash if missing', () => {
      const input = 'api/gallery/image?url=test.jpg';
      const result = productionService.normalizeProjectViewUrl(input);
      expect(result).toBe('/api/gallery/image?url=test.jpg');
    });

    it('should handle null/undefined', () => {
      expect(productionService.normalizeProjectViewUrl(null)).toBe(null);
      expect(productionService.normalizeProjectViewUrl(undefined)).toBe(undefined);
    });

    it('should handle non-string values', () => {
      expect(productionService.normalizeProjectViewUrl(123)).toBe(123);
      expect(productionService.normalizeProjectViewUrl({})).toEqual({});
    });
  });
});
