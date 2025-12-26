/**
 * Moduł emisji zdarzeń produkcyjnych przez SSE
 * Centralizuje logikę broadcastowania zmian w module produkcji
 */

const { broadcastEvent } = require('./index');

/**
 * Typy zdarzeń produkcyjnych
 */
const ProductionEventType = {
  OPERATION_STARTED: 'production.operation.started',
  OPERATION_PAUSED: 'production.operation.paused',
  OPERATION_COMPLETED: 'production.operation.completed',
  OPERATION_CANCELLED: 'production.operation.cancelled',
  OPERATION_PROBLEM: 'production.operation.problem',
  WORK_ORDER_UPDATED: 'production.workorder.updated',
  ORDER_UPDATED: 'production.order.updated',
  KPI_UPDATED: 'production.kpi.updated'
};

/**
 * Helper do emisji zdarzeń produkcyjnych
 * @param {Object} params
 * @param {string} params.type - Typ zdarzenia (z ProductionEventType)
 * @param {string} params.operationId - ID operacji (opcjonalne)
 * @param {string} params.orderId - ID zlecenia produkcyjnego (opcjonalne)
 * @param {string} params.workOrderId - ID work order (opcjonalne)
 * @param {number} params.roomId - ID pokoju produkcyjnego (opcjonalne)
 * @param {Object} params.payload - Dodatkowe dane (opcjonalne)
 */
function emitProductionUpdate({ type, operationId, orderId, workOrderId, roomId, payload = {} }) {
  if (!type) {
    console.warn('[SSE] emitProductionUpdate: brak typu zdarzenia');
    return;
  }

  const event = {
    type,
    timestamp: new Date().toISOString(),
    data: {
      operationId,
      orderId,
      workOrderId,
      roomId,
      ...payload
    }
  };

  // Filtruj undefined values
  Object.keys(event.data).forEach(key => {
    if (event.data[key] === undefined) {
      delete event.data[key];
    }
  });

  console.log(`[SSE] Emitting event: ${type}`, {
    operationId,
    orderId,
    workOrderId,
    roomId
  });

  broadcastEvent(event);
}

/**
 * Emisja zdarzenia startu operacji
 */
function emitOperationStarted(operationId, orderId, workOrderId, roomId, additionalData = {}) {
  emitProductionUpdate({
    type: ProductionEventType.OPERATION_STARTED,
    operationId,
    orderId,
    workOrderId,
    roomId,
    payload: additionalData
  });
}

/**
 * Emisja zdarzenia pauzy operacji
 */
function emitOperationPaused(operationId, orderId, workOrderId, roomId, additionalData = {}) {
  emitProductionUpdate({
    type: ProductionEventType.OPERATION_PAUSED,
    operationId,
    orderId,
    workOrderId,
    roomId,
    payload: additionalData
  });
}

/**
 * Emisja zdarzenia zakończenia operacji
 */
function emitOperationCompleted(operationId, orderId, workOrderId, roomId, additionalData = {}) {
  emitProductionUpdate({
    type: ProductionEventType.OPERATION_COMPLETED,
    operationId,
    orderId,
    workOrderId,
    roomId,
    payload: additionalData
  });
}

/**
 * Emisja zdarzenia anulowania operacji
 */
function emitOperationCancelled(operationId, orderId, workOrderId, roomId, additionalData = {}) {
  emitProductionUpdate({
    type: ProductionEventType.OPERATION_CANCELLED,
    operationId,
    orderId,
    workOrderId,
    roomId,
    payload: additionalData
  });
}

/**
 * Emisja zdarzenia problemu w operacji
 */
function emitOperationProblem(operationId, orderId, workOrderId, roomId, additionalData = {}) {
  emitProductionUpdate({
    type: ProductionEventType.OPERATION_PROBLEM,
    operationId,
    orderId,
    workOrderId,
    roomId,
    payload: additionalData
  });
}

/**
 * Emisja zdarzenia aktualizacji work order
 */
function emitWorkOrderUpdated(workOrderId, roomId, additionalData = {}) {
  emitProductionUpdate({
    type: ProductionEventType.WORK_ORDER_UPDATED,
    workOrderId,
    roomId,
    payload: additionalData
  });
}

/**
 * Emisja zdarzenia aktualizacji zlecenia produkcyjnego
 */
function emitOrderUpdated(orderId, workOrderId, roomId, additionalData = {}) {
  emitProductionUpdate({
    type: ProductionEventType.ORDER_UPDATED,
    orderId,
    workOrderId,
    roomId,
    payload: additionalData
  });
}

/**
 * Emisja zdarzenia aktualizacji KPI
 */
function emitKpiUpdated(roomId, additionalData = {}) {
  emitProductionUpdate({
    type: ProductionEventType.KPI_UPDATED,
    roomId,
    payload: additionalData
  });
}

module.exports = {
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
};
