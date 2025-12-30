# Instrukcja Wdrożenia Systemu Zarządzania Produkcją

## 📋 Wymagania wstępne

- Node.js 18+
- Supabase z dostępem do tworzenia funkcji RPC
- Uprawnienia do wykonania migracji SQL

## 🗄️ Kolejność migracji (WAŻNE!)

Migracje muszą być wykonane w tej kolejności:

1. `20251226_add_production_management_tables.sql`
   - Tworzy wszystkie tabele systemu zarządzania produkcją
   - Dodaje widoki i triggery

2. `20251226_add_operator_transfer_procedure.sql`
   - Tworzy procedurę `transfer_operator` dla atomowych transferów
   - Zależy od tabel z pierwszej migracji

## 🚀 Uruchomienie aplikacji

1. Zainstaluj zależności:
```bash
npm install
```

2. Uruchom migracje:
```bash
# Jeśli używasz Supabase CLI
supabase db push

# Lub wykonaj migracje ręcznie w panelu Supabase
```

3. Uruchom serwer:
```bash
npm start
# lub w trybie deweloperskim
npm run dev
```

## 🔧 Konfiguracja

Brak dodatkowych zmiennych środowiskowych - system używa istniejącej konfiguracji Supabase.

## ✅ Weryfikacja wdrożenia

1. Sprawdź endpointy:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/health
```

2. Testuj nowe endpointy:
```bash
# Stany maszyn
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/production/machines/status

# Dashboard szefa
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/production/dashboard/executive
```

3. Uruchom testy:
```bash
npm test -- production.test.js
```

## ⚠️ Uwagi dotyczące wdrożenia

### Fallback dla transferów operatorów
System ma wbudowany mechanizm fallback:
- Jeśli procedura `transfer_operator` nie istnieje (brak migracji #2), transfer zadziała bez transakcji
- Po wykonaniu migracji #2 transfery będą atomowe

### Zdarzenia SSE
Upewnij się, że klienci nasłuchują na nowe zdarzenia:
- `machine_status_changed`
- `material_shortage`
- `operator_transferred`
- `risk_level_changed`

### Role i uprawnienia
Sprawdź, że użytkownicy mają odpowiednie role:
- `ADMIN` - pełny dostęp
- `PRODUCTION_MANAGER` - zarządzanie operatorami
- `OPERATOR` - zgłaszanie awarii
- `WAREHOUSE` - zarządzanie materiałami

## 📊 Dane testowe

Migracja #1 zawiera przykładowe dane:
- 3 pokoje produkcyjne
- 2 gniazda produkcyjne
- 3 maszyny
- 5 materiałów z progi minimalnymi

## 🔄 Aktualizacja

Przy aktualizacji systemu:
1. Zawsze wykonuj migracje w kolejności
2. Przetestuj nowe funkcje na środowisku deweloperskim
3. Uruchom pełny zestaw testów

## 🐛 Problemy i rozwiązania

### "Function transfer_operator does not exist"
- Rozwiązanie: wykonaj migrację `20251226_add_operator_transfer_procedure.sql`
- Fallback: system będzie działał bez transakcji

### Brak uprawnień do RPC
- Rozwiązanie: nadaj uprawnienia `GRANT EXECUTE ON FUNCTION public.transfer_operator TO authenticated;`

### SSE nie działa
- Sprawdź, że endpoint `/api/events` jest dostępny
- Upewnij się, że klient ma poprawne uprawnienia

## 📞 Wsparcie

W razie problemów:
1. Sprawdź logi serwera
2. Uruchom testy diagnostyczne
3. Skontaktuj się z zespołem deweloperskim
