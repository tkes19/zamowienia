# API: Usuwanie użytkowników z kontrolą powiązań

## Przegląd

System zarządzania użytkownikami obsługuje dwa tryby usuwania:
- **Soft delete** (domyślny): Dezaktywacja użytkownika (`isActive = false`)
- **Hard delete** (opcjonalny): Trwałe usunięcie z bazy danych

## Endpointy

### 1. Sprawdzanie powiązań użytkownika

**GET** `/api/admin/users/:id/dependencies`

Sprawdza wszystkie powiązania użytkownika w systemie przed usunięciem.

#### Autoryzacja
- Wymaga roli: `ADMIN`

#### Parametry
- `id` (path) - UUID użytkownika

#### Odpowiedź sukcesu (200)
```json
{
  "status": "success",
  "canDelete": false,
  "dependencies": {
    "orders": 5,
    "customers": 2,
    "folderAccess": 3,
    "orderDrafts": 1
  },
  "blockers": ["orders"]
}
```

#### Pola odpowiedzi
- `canDelete` (boolean) - Czy możliwe jest hard delete
- `dependencies` (object) - Liczba powiązań w każdej kategorii
  - `orders` - Zamówienia użytkownika (BLOKUJE hard delete)
  - `customers` - Klienci przypisani do użytkownika (zostaną odpięci)
  - `folderAccess` - Dostępy do folderów (zostaną usunięte)
  - `orderDrafts` - Szkice zamówień (zostaną usunięte)
- `blockers` (array) - Lista kategorii blokujących hard delete

#### Przykłady

**Użytkownik bez powiązań:**
```json
{
  "status": "success",
  "canDelete": true,
  "dependencies": {},
  "blockers": []
}
```

**Użytkownik z zamówieniami:**
```json
{
  "status": "success",
  "canDelete": false,
  "dependencies": {
    "orders": 12
  },
  "blockers": ["orders"]
}
```

---

### 2. Usuwanie użytkownika

**DELETE** `/api/admin/users/:id`

Usuwa lub dezaktywuje użytkownika.

#### Autoryzacja
- Wymaga roli: `ADMIN`

#### Parametry
- `id` (path) - UUID użytkownika
- `hard` (query, opcjonalny) - Jeśli `true`, wykonuje hard delete

#### Soft delete (domyślny)

**Request:**
```
DELETE /api/admin/users/59694534-29c0-4bad-b8b8-9cf5b2161935
```

**Odpowiedź sukcesu (200):**
```json
{
  "status": "success",
  "message": "Użytkownik zdezaktywowany",
  "data": {
    "id": "59694534-29c0-4bad-b8b8-9cf5b2161935",
    "name": "Marcin Dulemba",
    "isActive": false,
    "updatedAt": "2025-12-30T00:15:00.000Z"
  }
}
```

#### Hard delete

**Request:**
```
DELETE /api/admin/users/59694534-29c0-4bad-b8b8-9cf5b2161935?hard=true
```

**Odpowiedź sukcesu (200):**
```json
{
  "status": "success",
  "message": "Użytkownik usunięty na stałe"
}
```

**Odpowiedź blokady (400):**
```json
{
  "status": "blocked",
  "message": "Nie można usunąć użytkownika. Ma przypisane 5 zamówień.",
  "dependencies": {
    "orders": 5
  },
  "blockers": ["orders"]
}
```

---

## Workflow usuwania w panelu admina

### 1. Kliknięcie przycisku "Usuń"

Frontend automatycznie sprawdza powiązania:
```javascript
GET /api/admin/users/:id/dependencies
```

### 2. Scenariusze

#### A. Brak powiązań
- Wyświetla standardowe potwierdzenie soft delete
- Opcjonalnie: możliwość wyboru hard delete

#### B. Powiązania bez blokad
```
Użytkownik "Jan Kowalski" ma następujące powiązania:

• 3 klientów (zostaną odpięci)
• 2 dostępy do folderów (zostaną usunięte)

✅ Możliwe jest trwałe usunięcie

Wybierz opcję:
OK = Usuń na stałe (nieodwracalne)
Anuluj = Tylko zdezaktywuj
```

#### C. Powiązania z blokadami
```
Użytkownik "Jan Kowalski" ma następujące powiązania:

• 12 zamówień (BLOKUJE trwałe usunięcie)
• 5 klientów (zostaną odpięci)

❌ Nie można usunąć na stałe z powodu: orders

Możesz:
1. Zdezaktywować użytkownika (pozostanie w bazie)
2. Anulować
```

---

## Polityka kluczy obcych

| Tabela | Kolumna | Akcja przy DELETE |
|--------|---------|-------------------|
| `Order` | `userId` | **RESTRICT** (blokuje) |
| `Customer` | `salesRepId` | SET NULL |
| `UserFolderAccess` | `userId` | CASCADE |
| `UserFolderAccess` | `assignedBy` | SET NULL |
| `order_drafts` | `user_id` | CASCADE |
| `Account` | `userId` | CASCADE |
| `Session` | `userId` | CASCADE |
| `OrderStatusHistory` | `changedBy` | SET NULL |

**Blokery hard delete:**
- Zamówienia (`Order.userId`) - wymagają ręcznego przeniesienia lub usunięcia

---

## Przykłady użycia

### Sprawdzenie powiązań przed usunięciem
```bash
curl -X GET \
  'http://localhost:3001/api/admin/users/59694534-29c0-4bad-b8b8-9cf5b2161935/dependencies' \
  -H 'Cookie: auth-token=...'
```

### Soft delete (bezpieczny)
```bash
curl -X DELETE \
  'http://localhost:3001/api/admin/users/59694534-29c0-4bad-b8b8-9cf5b2161935' \
  -H 'Cookie: auth-token=...'
```

### Hard delete (tylko gdy brak blokad)
```bash
curl -X DELETE \
  'http://localhost:3001/api/admin/users/59694534-29c0-4bad-b8b8-9cf5b2161935?hard=true' \
  -H 'Cookie: auth-token=...'
```

---

## Bezpieczeństwo

1. **Autoryzacja**: Tylko użytkownicy z rolą `ADMIN` mogą usuwać użytkowników
2. **Walidacja**: Backend sprawdza powiązania przed hard delete
3. **Audyt**: Wszystkie operacje są logowane w konsoli serwera
4. **Nieodwracalność**: Hard delete jest nieodwracalny - wymaga podwójnego potwierdzenia

---

## Migracja danych

Jeśli potrzebujesz usunąć użytkownika z zamówieniami:

1. Przenieś zamówienia na innego użytkownika:
```sql
UPDATE "Order" 
SET "userId" = 'new-user-id' 
WHERE "userId" = 'old-user-id';
```

2. Następnie wykonaj hard delete przez API

---

## Changelog

- **2025-12-30**: Dodano endpoint `/dependencies` i obsługę hard delete z kontrolą blokad
- **2025-12-29**: Implementacja soft delete jako domyślnego trybu
