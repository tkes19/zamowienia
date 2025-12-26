/**
 * Testy jednostkowe dla modułu emisji zdarzeń produkcyjnych SSE
 */

const { describe, it, expect, vi, beforeEach, afterEach } = require('vitest');
const {
  ProductionEventType,
  emitProductionUpdate,
  emitOperationStarted,
  emitOperationPaused,
  emitOperationCompleted,
  emitOperationCancelled,
  emitOperationProblem,
  emitWorkOrderUpdated,
  emitOrderUpdated,
  emitKpiUpdated
} = require('./productionEvents');

// Mock modułu SSE
vi.mock('./index', () => ({
  broadcastEvent: vi.fn()
}));

const { broadcastEvent } = require('./index');

describe('productionEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ProductionEventType', () => {
    it('powinien zawierać wszystkie typy zdarzeń', () => {
      expect(ProductionEventType.OPERATION_STARTED).toBe('production.operation.started');
      expect(ProductionEventType.OPERATION_PAUSED).toBe('production.operation.paused');
      expect(ProductionEventType.OPERATION_COMPLETED).toBe('production.operation.completed');
      expect(ProductionEventType.OPERATION_CANCELLED).toBe('production.operation.cancelled');
      expect(ProductionEventType.OPERATION_PROBLEM).toBe('production.operation.problem');
      expect(ProductionEventType.WORK_ORDER_UPDATED).toBe('production.workorder.updated');
      expect(ProductionEventType.ORDER_UPDATED).toBe('production.order.updated');
      expect(ProductionEventType.KPI_UPDATED).toBe('production.kpi.updated');
    });
  });

  describe('emitProductionUpdate', () => {
    it('powinien emitować zdarzenie z pełnymi danymi', () => {
      const mockDate = new Date('2025-12-24T12:00:00Z');
      vi.setSystemTime(mockDate);

      emitProductionUpdate({
        type: 'production.operation.started',
        operationId: 'op-123',
        orderId: 'order-456',
        workOrderId: 'wo-789',
        roomId: 1,
        payload: { userId: 'user-1', status: 'active' }
      });

      expect(broadcastEvent).toHaveBeenCalledWith({
        type: 'production.operation.started',
        timestamp: mockDate.toISOString(),
        data: {
          operationId: 'op-123',
          orderId: 'order-456',
          workOrderId: 'wo-789',
          roomId: 1,
          userId: 'user-1',
          status: 'active'
        }
      });

      vi.useRealTimers();
    });

    it('powinien filtrować undefined values z danych', () => {
      emitProductionUpdate({
        type: 'production.operation.started',
        operationId: 'op-123',
        orderId: undefined,
        workOrderId: null,
        roomId: 1
      });

      const call = broadcastEvent.mock.calls[0][0];
      expect(call.data).toHaveProperty('operationId');
      expect(call.data).toHaveProperty('roomId');
      expect(call.data).not.toHaveProperty('orderId');
      expect(call.data).toHaveProperty('workOrderId', null);
    });

    it('powinien logować ostrzeżenie gdy brak typu', () => {
      emitProductionUpdate({
        operationId: 'op-123'
      });

      expect(console.warn).toHaveBeenCalledWith('[SSE] emitProductionUpdate: brak typu zdarzenia');
      expect(broadcastEvent).not.toHaveBeenCalled();
    });

    it('powinien obsługiwać puste payload', () => {
      emitProductionUpdate({
        type: 'production.operation.started',
        operationId: 'op-123'
      });

      expect(broadcastEvent).toHaveBeenCalled();
      const call = broadcastEvent.mock.calls[0][0];
      expect(call.data).toHaveProperty('operationId', 'op-123');
    });
  });

  describe('emitOperationStarted', () => {
    it('powinien emitować zdarzenie startu operacji', () => {
      emitOperationStarted('op-123', 'order-456', 'wo-789', 1, { userId: 'user-1' });

      expect(broadcastEvent).toHaveBeenCalled();
      const call = broadcastEvent.mock.calls[0][0];
      expect(call.type).toBe('production.operation.started');
      expect(call.data.operationId).toBe('op-123');
      expect(call.data.orderId).toBe('order-456');
      expect(call.data.workOrderId).toBe('wo-789');
      expect(call.data.roomId).toBe(1);
      expect(call.data.userId).toBe('user-1');
    });
  });

  describe('emitOperationPaused', () => {
    it('powinien emitować zdarzenie pauzy operacji', () => {
      emitOperationPaused('op-123', 'order-456', 'wo-789', 1, { reason: 'Przerwa' });

      expect(broadcastEvent).toHaveBeenCalled();
      const call = broadcastEvent.mock.calls[0][0];
      expect(call.type).toBe('production.operation.paused');
      expect(call.data.reason).toBe('Przerwa');
    });
  });

  describe('emitOperationCompleted', () => {
    it('powinien emitować zdarzenie zakończenia operacji', () => {
      emitOperationCompleted('op-123', 'order-456', 'wo-789', 1, { 
        quantity: 100, 
        actualTime: 45 
      });

      expect(broadcastEvent).toHaveBeenCalled();
      const call = broadcastEvent.mock.calls[0][0];
      expect(call.type).toBe('production.operation.completed');
      expect(call.data.quantity).toBe(100);
      expect(call.data.actualTime).toBe(45);
    });
  });

  describe('emitOperationCancelled', () => {
    it('powinien emitować zdarzenie anulowania operacji', () => {
      emitOperationCancelled('op-123', 'order-456', 'wo-789', 1);

      expect(broadcastEvent).toHaveBeenCalled();
      const call = broadcastEvent.mock.calls[0][0];
      expect(call.type).toBe('production.operation.cancelled');
    });
  });

  describe('emitOperationProblem', () => {
    it('powinien emitować zdarzenie problemu w operacji', () => {
      emitOperationProblem('op-123', 'order-456', 'wo-789', 1, { 
        problemType: 'MATERIAL_SHORTAGE' 
      });

      expect(broadcastEvent).toHaveBeenCalled();
      const call = broadcastEvent.mock.calls[0][0];
      expect(call.type).toBe('production.operation.problem');
      expect(call.data.problemType).toBe('MATERIAL_SHORTAGE');
    });
  });

  describe('emitWorkOrderUpdated', () => {
    it('powinien emitować zdarzenie aktualizacji work order', () => {
      emitWorkOrderUpdated('wo-789', 1, { 
        oldStatus: 'planned', 
        newStatus: 'in_progress' 
      });

      expect(broadcastEvent).toHaveBeenCalled();
      const call = broadcastEvent.mock.calls[0][0];
      expect(call.type).toBe('production.workorder.updated');
      expect(call.data.workOrderId).toBe('wo-789');
      expect(call.data.roomId).toBe(1);
      expect(call.data.oldStatus).toBe('planned');
      expect(call.data.newStatus).toBe('in_progress');
    });
  });

  describe('emitOrderUpdated', () => {
    it('powinien emitować zdarzenie aktualizacji zlecenia', () => {
      emitOrderUpdated('order-456', 'wo-789', 1, { status: 'completed' });

      expect(broadcastEvent).toHaveBeenCalled();
      const call = broadcastEvent.mock.calls[0][0];
      expect(call.type).toBe('production.order.updated');
      expect(call.data.orderId).toBe('order-456');
      expect(call.data.status).toBe('completed');
    });
  });

  describe('emitKpiUpdated', () => {
    it('powinien emitować zdarzenie aktualizacji KPI', () => {
      const kpiData = {
        today: { total: 10, completed: 5 },
        week: { total: 50, completed: 30 }
      };

      emitKpiUpdated(1, kpiData);

      expect(broadcastEvent).toHaveBeenCalled();
      const call = broadcastEvent.mock.calls[0][0];
      expect(call.type).toBe('production.kpi.updated');
      expect(call.data.roomId).toBe(1);
      expect(call.data.today).toEqual({ total: 10, completed: 5 });
    });

    it('powinien obsługiwać KPI bez roomId (globalne)', () => {
      emitKpiUpdated(null, { today: { total: 10 } });

      expect(broadcastEvent).toHaveBeenCalled();
      const call = broadcastEvent.mock.calls[0][0];
      expect(call.data).not.toHaveProperty('roomId');
    });
  });

  describe('Integracja - sekwencja zdarzeń', () => {
    it('powinien poprawnie emitować sekwencję zdarzeń dla operacji', () => {
      // Start operacji
      emitOperationStarted('op-1', 'order-1', 'wo-1', 1, { userId: 'user-1' });
      expect(broadcastEvent).toHaveBeenCalledTimes(1);

      // Pauza
      emitOperationPaused('op-1', 'order-1', 'wo-1', 1, { reason: 'Przerwa' });
      expect(broadcastEvent).toHaveBeenCalledTimes(2);

      // Wznowienie (start ponownie)
      emitOperationStarted('op-1', 'order-1', 'wo-1', 1, { userId: 'user-1' });
      expect(broadcastEvent).toHaveBeenCalledTimes(3);

      // Zakończenie
      emitOperationCompleted('op-1', 'order-1', 'wo-1', 1, { quantity: 100 });
      expect(broadcastEvent).toHaveBeenCalledTimes(4);

      // Aktualizacja work order
      emitWorkOrderUpdated('wo-1', 1, { newStatus: 'completed' });
      expect(broadcastEvent).toHaveBeenCalledTimes(5);

      // Wszystkie wywołania powinny mieć timestamp
      broadcastEvent.mock.calls.forEach(call => {
        expect(call[0]).toHaveProperty('timestamp');
        expect(call[0]).toHaveProperty('type');
        expect(call[0]).toHaveProperty('data');
      });
    });
  });
});
