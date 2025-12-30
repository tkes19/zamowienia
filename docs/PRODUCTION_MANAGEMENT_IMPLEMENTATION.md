# Wdrożenie Systemu Zarządzania Produkcją
## Kompletny plan implementacji (Dashboard szefa, stany maszyn, braki materiałów, przenoszenie operatorów)

---

## 1. Wprowadzenie i cel projektu

### 1.1 Cel biznesowy
Stworzenie systemu, który:
- Minimalizuje ryzyko opóźnień zamówień poprzez wczesne wykrywanie zatorów
- Optymalizuje wykorzystanie zasobów (ludzi, maszyn, materiałów)
- Daje szefowi i zastępcy produkcji narzędzia do podejmowania decyzji w czasie rzeczywistym
- Automatyzuje powiadomienia o brakach i awariach

### 1.2 Kluczowe funkcje
1. **Dashboard szefa** – widok ryzyk i zatorów w czasie rzeczywistym
2. **Monitoring maszyn** – stany awarii, planowane przeglądy
3. **Zarządzanie materiałami** – stany magazynowe, automatyczne zamawianie braków
4. **Przenoszenie operatorów** – sugestie optymalizacji obsady
5. **Integracja z zamówieniami** – automatyczne tworzenie zleceń produkcyjnych

---

## 2. Diagram zależności modułów

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Zamówienia    │───▶│   Produkcja     │───▶│  Dashboard Szef │
│   (istniejące)  │    │   (nowe moduły) │    │   (agregacja)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                        ┌─────────────────┐    ┌─────────────────┐
                        │ MachineStatus   │    │ MaterialStock   │
                        │ OperatorSkill   │    │ ProductMaterial │
                        │ OperatorAssign  │    │                 │
                        └─────────────────┘    └─────────────────┘
```

**Kolejność wdrożenia:**
1. Podstawowa infrastruktura produkcji (już istnieje)
2. MachineStatus i MaterialStock (tydzień 1-2)
3. Sugestie przenoszenia operatorów (tydzień 3)
4. Dashboard szefa (tydzień 4)

---

## 3. Model danych

### 3.1 Nowe tabele (MVP)

```sql
-- Stany maszyn
CREATE TABLE MachineStatus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workCenterId UUID REFERENCES WorkCenter(id),
    status TEXT NOT NULL CHECK (status IN ('ok', 'warning', 'down')),
    lastUpdate TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    updatedBy UUID REFERENCES Users(id)
);

-- Umiejętności operatorów
CREATE TABLE OperatorSkill (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operatorId UUID REFERENCES Users(id),
    workCenterType TEXT NOT NULL REFERENCES WorkCenterType(type),
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
    UNIQUE(operatorId, workCenterType)
);

-- Aktualne przypisania operatorów
CREATE TABLE OperatorAssignment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operatorId UUID REFERENCES Users(id),
    roomId UUID REFERENCES ProductionRoom(id),
    fromTime TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    toTime TIMESTAMP WITH TIME ZONE,
    UNIQUE(operatorId)
);

-- Stany magazynowe półproduktów
CREATE TABLE MaterialStock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    materialCode TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'szt',
    minThreshold DECIMAL(10,2) NOT NULL DEFAULT 0,
    autoOrderEnabled BOOLEAN DEFAULT false,
    lastUpdated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedBy UUID REFERENCES Users(id)
);

-- Powiązania produktów z materiałami
CREATE TABLE ProductMaterial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    productId UUID REFERENCES Product(id),
    materialId UUID REFERENCES MaterialStock(id),
    quantityPerUnit DECIMAL(10,4) NOT NULL,
    UNIQUE(productId, materialId)
);
```

### 3.2 Rozszerzenia istniejących tabel

```sql
-- Dodanie do ProductionOrder
ALTER TABLE ProductionOrder ADD COLUMN riskLevel TEXT DEFAULT 'normal';
ALTER TABLE ProductionOrder ADD COLUMN riskReason TEXT;
ALTER TABLE ProductionOrder ADD COLUMN blockedByMachineId UUID REFERENCES MachineStatus(id);
ALTER TABLE ProductionOrder ADD COLUMN blockedByMaterialId UUID REFERENCES MaterialStock(id);

-- Dodanie do ProductionOperation
ALTER TABLE ProductionOperation ADD COLUMN actualOperatorId UUID REFERENCES Users(id);
ALTER TABLE ProductionOperation ADD COLUMN machineStatusId UUID REFERENCES MachineStatus(id);
```

---

## 4. Fazy wdrożenia

### Faza 0: Fundamenty (już zrobione)
- [x] Podstawowa struktura produkcyjna (ProductionRoom, WorkCenter, WorkStation)
- [x] Ścieżki produkcyjne i automatyczne tworzenie zleceń
- [x] Panel operatora z akcjami start/pauza/zakończ
- [x] SSE dla aktualizacji w czasie rzeczywistym

### Faza 1: Monitoring maszyn i materiałów (tydzień 1-2)

#### 1.1 Backend
```javascript
// Nowe endpointy w backend/server.js
GET /api/machines/status - pobierz stany maszyn
POST /api/machines/:id/status - aktualizuj stan
GET /api/materials/stock - stany magazynowe
POST /api/materials/:id/stock - aktualizuj stan
GET /api/materials/shortages - lista braków
```

#### 1.2 Frontend
- Widgety w panelu admina do zarządzania maszynami
- Prosty panel stanów magazynowych
- Powiadomienia o brakach (toast + email)

#### Kryteria akceptacji
- [ ] Operator może zgłosić awarię z panelu
- [ ] System pokazuje, które ZP są zablokowane przez awarię
- [ ] Alert przy stanie materiału < minThreshold
- [ ] Lista braków dostępna w dashboardzie

### Faza 2: Optymalizacja obsady (tydzień 3)

#### 2.1 Backend
```javascript
// Logika sugestii
GET /api/production/operator-suggestions
POST /api/production/transfer-operator
```

#### 2.2 Algorytm sugestii
```sql
WITH room_urgency AS (
  SELECT 
    r.id as roomId,
    COUNT(po.id) as queueSize,
    AVG(EXTRACT(EPOCH FROM (NOW() - po.created))/60) as avgWaitMinutes
  FROM ProductionRoom r
  LEFT JOIN WorkCenter wc ON wc.roomId = r.id
  LEFT JOIN ProductionOperation po ON po.workCenterId = wc.id 
    AND po.status IN ('pending', 'active', 'paused')
  GROUP BY r.id
),
available_operators AS (
  SELECT 
    os.operatorId,
    oa.roomId as currentRoomId,
    os.workCenterType,
    os.level
  FROM OperatorSkill os
  JOIN OperatorAssignment oa ON oa.operatorId = os.operatorId
  WHERE oa.toTime IS NULL
)
SELECT 
  ao.operatorId,
  ao.currentRoomId,
  ru.roomId as targetRoomId,
  (ru.queueSize * ru.avgWaitMinutes) - 15 as urgencyScore
FROM room_urgency ru
JOIN WorkCenter wc ON wc.roomId = ru.roomId
JOIN available_operators ao ON ao.workCenterType = wc.type
WHERE ru.queueSize > 2
ORDER BY urgencyScore DESC
LIMIT 5;
```

#### Kryteria akceptacji
- [ ] System sugeruje przeniesienie operatora przy zatorze
- [ ] Przycisk "Przenieś" aktualizuje przypisanie
- [ ] SSE informuje o zmianie pokoju operatora
- [ ] Historia przeniesień jest logowana

### Faza 3: Dashboard szefa (tydzień 4)

#### 3.1 Endpointy agregujące
```javascript
GET /api/production/dashboard/executive
{
  "risks": {
    "atRiskOrders": 3,
    "bottleneckRoom": "UV-PRINT",
    "machinesDown": 1,
    "materialShortages": 2
  },
  "actions": [
    {
      "type": "transfer_operator",
      "description": "Przenieś Janka z Laser-1 do UV-PRINT",
      "impact": "odblokuje 5 ZP"
    },
    {
      "type": "order_material",
      "description": "Zamów 20 szt. XYZ",
      "impact": "odblokuje 3 ZP"
    }
  ],
  "kpi": {
    "throughputToday": 42,
    "throughputAvg": 38,
    "avgLeadTime": 4.2,
    "onTimeDelivery": 0.87
  }
}
```

#### 3.2 UI Dashboard
- 3 główne kafle: Ryzyko, Przepustowość, Akcje
- Heatmapa zatorów (7 dni)
- Lista zagrożonych zamówień z drilldown

#### Kryteria akceptacji
- [ ] Szef widzi liczbę zagrożonych zamówień
- [ ] Klik w ryzyko pokazuje szczegóły
- [ ] Sugestie akcji z przyciskami do wykonania
- [ ] Odświeżanie co 30 sekund + SSE

---

## 5. Endpointy API (pełna specyfikacja)

### 5.1 Moduł maszyn
```
GET    /api/machines/status
POST   /api/machines/:id/status
GET    /api/machines/:id/history
POST   /api/machines/:id/maintenance
```

### 5.2 Moduł materiałów
```
GET    /api/materials/stock
POST   /api/materials/:id/stock
GET    /api/materials/shortages
POST   /api/materials/bulk-update
GET    /api/materials/consumption-report
```

### 5.3 Moduł operatorów
```
GET    /api/operators/skills
POST   /api/operators/skills
GET    /api/operators/assignments
POST   /api/operators/transfer
GET    /api/operators/suggestions
```

### 5.4 Dashboard
```
GET    /api/production/dashboard/executive
GET    /api/production/dashboard/manager
GET    /api/production/risks
GET    /api/production/bottlenecks
POST   /api/production/resolve-risk
```

---

## 6. UI/UX per rola

### 6.1 Szef (Executive Dashboard)
- **Cel:** Szybka ocena ryzyka i podejmowanie decyzji
- **Widoki:** Mission Control, Heatmapa, Lista akcji
- **Akcje:** Eskalacja, zatwierdzenie przeniesień, zamawianie

### 6.2 Zastępca produkcji (Production Manager)
- **Cel:** Zarządzanie bieżącą produkcją
- **Widoki:** Tablica Kanban, Sugestie obsady, Stan maszyn
- **Akcje:** Przenoszenie operatorów, zgłaszanie awarii, planowanie

### 6.3 Operator (Production Floor)
- **Cel:** Wykonywanie zadań i zgłaszanie problemów
- **Widoki:** Panel zadań, Moje kompetencje
- **Akcje:** Start/Pauza/Zakończ, Zgłoś problem, Zmień pokój

---

## 7. Integracje

### 7.1 Powiadomienia
- **Email:** Awarie, braki materiałów, zagrożone terminy
- **Push (SSE):** Zmiany statusów, nowe sugestie
- **SMS (opcja):** Krytyczne awarie po godzinach

### 7.2 Systemy zewnętrzne
- **Serwis maszyn:** API ticketów (przyszłość)
- **Dostawcy:** Automatyczne zamówienia (przyszłość)
- **ERP:** Eksport raportów produkcji

---

## 8. Testy

### 8.1 Jednostkowe
- Logika sugestii operatorów
- Obliczanie ryzyka zamówień
- Aktualizacje stanów magazynowych

### 8.2 Integracyjne
- SSE aktualizacje
- Przepływ zamówień → zlecenia → operacje
- Przenoszenia operatorów

### 8.3 UAT
- Scenariusz zatoru i rozwiązania
- Awaria maszyny i odblokowanie ZP
- Brak materiału i automatyczne zamówienie

---

## 9. Wdrożenie i migracja

### 9.1 Migracja danych
```sql
-- Import stanów maszyn
INSERT INTO MachineStatus (workCenterId, status)
SELECT id, 'ok' FROM WorkCenter;

-- Import operatorów i ich pokoi
INSERT INTO OperatorAssignment (operatorId, roomId)
SELECT DISTINCT u.id, pr.roomId
FROM Users u
JOIN ProductionRoom pr ON pr.name = 'LASER-1' -- Przykład
WHERE u.role = 'OPERATOR';
```

### 9.2 Plan wdrożenia
1. **Tydzień 0:** Backup i przygotowanie środowiska
2. **Tydzień 1-2:** Faza 1 (stany maszyn i materiałów)
3. **Tydzień 3:** Faza 2 (optymalizacja obsady)
4. **Tydzień 4:** Faza 3 (dashboard szefa)
5. **Tydzień 5:** UAT i poprawki
6. **Tydzień 6:** Szkolenie i go-live

---

## 10. Metryki sukcesu

### 10.1 KPI biznesowe
- Redukcja opóźnień: target -30%
- Wykorzystanie maszyn: target +15%
- Czas reakcji na awarie: target -50%
- Poziom obsługi zamówień: target 95%

### 10.2 KPI techniczne
- Czas odpowiedzi API: <200ms
- SSE latency: <500ms
- Uptime: >99.5%
- Liczba bugów: <5/tydzień

---

## 11. Przyszłe rozszerzenia

### 11.1 Faza 2 (Q2 2025)
- Pełny WMS z przyjęciami i wydaniami
- Predykcja zużycia materiałów (AI)
- Mobilna aplikacja dla operatorów

### 11.2 Faza 3 (Q3 2025)
- Integracja z systemem serwisowym
- Automatyczne zamawianie u dostawców
- Zaawansowane analizy i raporty

---

## 12. Plan wycofania (Rollback)

### 12.1 Scenariusze awaryjne
- **Faza 1 fails:** Wyłącz nowe endpointy, wróć do manualnego zgłaszania awarii
- **Faza 2 fails:** Zablokuj przenoszenia operatorów, zachowaj statyczne przypisania
- **Faza 3 fails:** Wyłącz dashboard, użyj istniejących raportów

### 12.2 Procedura rollback
```sql
-- Wyłączenie funkcji
UPDATE SystemSettings SET feature_flag = false WHERE feature IN (
  'machine_monitoring',
  'operator_transfer',
  'executive_dashboard'
);

-- Przywrócenie widoków
DROP VIEW IF EXISTS ProductionRiskView;
```

### 12.3 Punkty kontrolne
- Po każdej fazie: backup bazy i decyzja "go/no-go"
- Kryteria kontynuacji: <5 bugów krytycznych, >80% akceptacji UAT

---

## 13. Zdarzenia SSE (Event Types)

### 13.1 Maszyny
```javascript
{
  type: 'machine_status_changed',
  data: { machineId, newStatus, oldStatus, timestamp }
}
```

### 13.2 Materiały
```javascript
{
  type: 'material_shortage',
  data: { materialId, currentQty, threshold, affectedOrders }
}
```

### 13.3 Operatorzy
```javascript
{
  type: 'operator_transferred',
  data: { operatorId, fromRoomId, toRoomId, timestamp }
}
```

### 13.4 Ryzyka
```javascript
{
  type: 'risk_level_changed',
  data: { orderId, newRisk, reason, actionable }
}
```

---

## 14. Szybki przewodnik (Quick Reference)

### 14.1 Szef - gdzie szukać
- **Dashboard:** Sekcja 3.1, Faza 3
- **Metryki ryzyka:** Sekcja 4.3, API 5.4
- **Akcje krytyczne:** Sekcja 6.1

### 14.2 Zastępca produkcji - gdzie szukać
- **Zarządzanie operatorami:** Sekcja 4.2, API 5.3
- **Stany maszyn:** Sekcja 4.1, API 5.1
- **Rozwiązywanie zatorów:** Sekcja 6.2

### 14.3 Operator - gdzie szukać
- **Panel zadań:** DESIGN_PRODUCTION_PANEL.md sekcja 3
- **Zgłaszanie problemów:** DESIGN_PRODUCTION_PANEL.md sekcja 3.4

---

## 15. Podsumowanie

System zarządzania produkcją przekształci chaotyczny proces w przewidywalną i optymalizowaną operację. Kluczowe korzyści:
- **Wczesne wykrywanie problemów** zamiast gaszenia pożarów
- **Optymalne wykorzystanie zasobów** przez inteligentne sugestie
- **Pełna widoczność** dla szefa bez konieczności pytania
- **Automatyzacja powiadomień** o brakach i awariach

Implementacja w 6 tygodni daje szybki zwrot z inwestycji i fundament do dalszych usprawnień.

---

*Dokument utworzony: 2025-12-26*  
*Autor: Cascade (architekt systemu)*  
*Wersja: 1.1*
