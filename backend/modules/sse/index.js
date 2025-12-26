/**
 * Moduł Server-Sent Events (SSE)
 * Zarządza połączeniami SSE i broadcast zdarzeń
 */

const sseClients = new Set();

/**
 * Broadcast zdarzenia do wszystkich połączonych klientów
 */
function broadcastEvent(payload) {
  const data = JSON.stringify(payload || {});
  
  for (const client of sseClients) {
    try {
      client.write(`event: message\n`);
      client.write(`data: ${data}\n\n`);
    } catch (e) {
      // Klient odłączony - usuń z listy
      try { 
        client.end(); 
      } catch (e2) {
        // Ignore
      }
      sseClients.delete(client);
    }
  }
}

/**
 * Dodanie nowego klienta SSE
 */
function addClient(res) {
  sseClients.add(res);
  
  // Wyślij event gotowości
  try {
    res.write(`event: ready\n`);
    res.write(`data: ${JSON.stringify({ status: 'ok', at: Date.now() })}\n\n`);
  } catch (e) {
    sseClients.delete(res);
  }
}

/**
 * Usunięcie klienta SSE
 */
function removeClient(res) {
  sseClients.delete(res);
  try {
    res.end();
  } catch (e) {
    // Ignore
  }
}

/**
 * Liczba aktywnych połączeń
 */
function getClientCount() {
  return sseClients.size;
}

/**
 * Middleware do obsługi SSE endpoint
 */
function createSSEHandler() {
  return (req, res) => {
    // Ustaw nagłówki SSE
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    if (res.flushHeaders) {
      res.flushHeaders();
    }
    
    // Dodaj klienta
    addClient(res);
    
    // Obsługa zamknięcia połączenia
    req.on('close', () => {
      removeClient(res);
    });
  };
}

module.exports = {
  broadcastEvent,
  addClient,
  removeClient,
  getClientCount,
  createSSEHandler
};
