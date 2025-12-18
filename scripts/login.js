const kioskForm = document.getElementById('kiosk-login-form');
const companyForm = document.getElementById('company-login-form');

const kioskErrorEl = document.getElementById('kiosk-error');
const companyErrorEl = document.getElementById('company-error');

const companyPanel = document.getElementById('company-panel');
const backToFormWrapper = document.getElementById('back-to-form-wrapper');

const kioskRoomField = document.getElementById('kiosk-room-field');
const kioskOperatorField = document.getElementById('kiosk-operator-field');
const kioskPinField = document.getElementById('kiosk-pin-field');
const kioskRoomSelect = document.getElementById('kiosk-room');
const kioskOperatorSelect = document.getElementById('kiosk-operator');
const kioskPinInput = document.getElementById('kiosk-pin');
const kioskChangeRoomBtn = document.getElementById('kiosk-change-room');

const kioskRoomIndicator = document.getElementById('kiosk-room-indicator');
const kioskRoomIndicatorValue = document.getElementById('kiosk-room-indicator-value');

const isKioskOnlyView = window.location.pathname === '/kiosk';
const KIOSK_ROOM_STORAGE_KEY = 'kioskRoomId';

let kioskChangeRoomBound = false;
let kioskBusy = false;

function updateKioskSubmitAvailability() {
  if (!kioskForm) return;
  if (kioskBusy) return;
  const roomId = getStoredRoomId();
  const userId = kioskOperatorSelect ? kioskOperatorSelect.value : null;
  const pin = kioskPinInput ? kioskPinInput.value : null;
  const pinStr = (pin || '').toString().trim();
  const ready = !!roomId && !!userId && /^\d{6}$/.test(pinStr);
  setSubmitDisabled(kioskForm, !ready);
}

function setError(target, message) {
  const el = target === 'kiosk' ? kioskErrorEl : companyErrorEl;
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function setSubmitDisabled(formEl, disabled, busyText) {
  if (!formEl) return;
  const submitBtn = formEl.querySelector('button[type="submit"]');
  if (!submitBtn) return;

  if (!submitBtn.dataset.originalText) {
    submitBtn.dataset.originalText = submitBtn.textContent || '';
  }

  const isDisabled = !!disabled;
  submitBtn.disabled = isDisabled;

  if (isDisabled && busyText) {
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.textContent = busyText;
    return;
  }

  submitBtn.removeAttribute('aria-busy');
  submitBtn.textContent = submitBtn.dataset.originalText;
}

function setFieldVisible(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  el.style.display = visible ? '' : 'none';
}

function setRoomStepVisible(visible) {
  setFieldVisible(kioskRoomField, !!visible);
  setFieldVisible(kioskOperatorField, !visible);
  setFieldVisible(kioskPinField, false);
  if (kioskChangeRoomBtn) kioskChangeRoomBtn.hidden = visible;
}

function setOperatorStepVisible(visible) {
  setFieldVisible(kioskRoomField, !visible);
  setFieldVisible(kioskOperatorField, !!visible);
  setFieldVisible(kioskPinField, false);
  if (kioskChangeRoomBtn) kioskChangeRoomBtn.hidden = !visible;
}

function setPinStepVisible(visible) {
  setFieldVisible(kioskPinField, !!visible);
}

if (kioskPinInput) {
  kioskPinInput.addEventListener('input', () => {
    const cleaned = kioskPinInput.value.replace(/\D/g, '').slice(0, 6);
    if (kioskPinInput.value !== cleaned) {
      kioskPinInput.value = cleaned;
    }
    updateKioskSubmitAvailability();
  });
}

function redirectAfterLogin(role) {
  if (role === 'ADMIN') {
    window.location.href = '/admin';
  } else if (['OPERATOR', 'PRODUCTION', 'PRODUCTION_MANAGER'].includes(role)) {
    window.location.href = '/production';
  } else if (role === 'GRAPHICS') {
    window.location.href = '/graphics.html';
  } else {
    window.location.href = '/';
  }
}

async function loadKioskRooms() {
  const response = await fetch('/api/kiosk/rooms', { credentials: 'include' });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.status !== 'success') {
    throw new Error(json.message || 'Nie udało się pobrać listy pokojów.');
  }
  return json.data || [];
}

async function loadKioskOperators(roomId) {
  const url = `/api/kiosk/operators?roomId=${encodeURIComponent(roomId)}`;
  const response = await fetch(url, { credentials: 'include' });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.status !== 'success') {
    throw new Error(json.message || 'Nie udało się pobrać listy operatorów.');
  }
  return json.data || [];
}

function getStoredRoomId() {
  try {
    return localStorage.getItem(KIOSK_ROOM_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

function setStoredRoomId(roomId) {
  try {
    localStorage.setItem(KIOSK_ROOM_STORAGE_KEY, roomId);
  } catch (e) {
    // ignore
  }
}

function clearStoredRoomId() {
  try {
    localStorage.removeItem(KIOSK_ROOM_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

async function initKioskMode() {
  setError('kiosk', null);

  if (kioskChangeRoomBtn && !kioskChangeRoomBound) {
    kioskChangeRoomBound = true;
    kioskChangeRoomBtn.addEventListener('click', () => {
      clearStoredRoomId();
      if (kioskRoomSelect) kioskRoomSelect.value = '';
      if (kioskOperatorSelect) kioskOperatorSelect.value = '';
      if (kioskPinInput) kioskPinInput.value = '';
      setError('kiosk', null);
      initKioskMode().catch((e) => {
        console.error('Błąd initKioskMode:', e);
        setError('kiosk', 'Nie udało się zainicjalizować kiosku.');
      });
    });
  }

  const storedRoomId = getStoredRoomId();
  if (!storedRoomId) {
    if (kioskRoomIndicator) kioskRoomIndicator.hidden = true;
    setRoomStepVisible(true);
    kioskBusy = true;
    setSubmitDisabled(kioskForm, true, 'Ładowanie...');
    if (kioskRoomSelect) {
      kioskRoomSelect.disabled = true;
      kioskRoomSelect.innerHTML = '<option value="">Ładowanie pokojów...</option>';
      kioskRoomSelect.value = '';
      kioskRoomSelect.onchange = null;
    }
    try {
      const rooms = await loadKioskRooms();
      if (kioskRoomSelect) {
        kioskRoomSelect.disabled = false;
        kioskRoomSelect.innerHTML = '<option value="">Wybierz pokój...</option>';
        rooms.forEach((room) => {
          const opt = document.createElement('option');
          opt.value = room.id;
          opt.textContent = room.name || room.code || room.id;
          kioskRoomSelect.appendChild(opt);
        });
        kioskRoomSelect.onchange = async () => {
          const picked = kioskRoomSelect.value;
          if (!picked) return;
          setStoredRoomId(picked);
          await initKioskMode();
        };
      }
    } catch (e) {
      console.error('Błąd ładowania pokojów kiosku:', e);
      setError('kiosk', e.message || 'Nie udało się pobrać pokojów.');
    } finally {
      kioskBusy = false;
      if (kioskRoomSelect) kioskRoomSelect.disabled = false;
      updateKioskSubmitAvailability();
    }
    return;
  }

  setOperatorStepVisible(true);
  kioskBusy = true;
  setSubmitDisabled(kioskForm, true, 'Ładowanie...');
  if (kioskOperatorSelect) {
    kioskOperatorSelect.disabled = true;
    kioskOperatorSelect.innerHTML = '<option value="">Ładowanie operatorów...</option>';
    kioskOperatorSelect.value = '';
  }
  if (kioskPinInput) kioskPinInput.value = '';
  setPinStepVisible(false);
  try {
    const [operators, rooms] = await Promise.all([
      loadKioskOperators(storedRoomId),
      loadKioskRooms().catch(() => []),
    ]);

    if (kioskRoomIndicator && kioskRoomIndicatorValue) {
      const roomIdStr = storedRoomId == null ? '' : String(storedRoomId);
      const room = (rooms || []).find(r => String(r?.id) === roomIdStr);
      kioskRoomIndicatorValue.textContent = room?.name || room?.code || (roomIdStr ? `Pokój #${roomIdStr}` : '');
      kioskRoomIndicator.hidden = false;
    }

    if (kioskOperatorSelect) {
      kioskOperatorSelect.innerHTML = '<option value="">Wybierz operatora...</option>';
      operators.forEach((user) => {
        const opt = document.createElement('option');
        opt.value = user.id;
        opt.textContent = user.name || user.id;
        kioskOperatorSelect.appendChild(opt);
      });

      kioskOperatorSelect.value = '';
      if (kioskPinInput) kioskPinInput.value = '';
      setPinStepVisible(false);

      kioskOperatorSelect.disabled = !operators || operators.length === 0;

      kioskOperatorSelect.onchange = () => {
        const picked = kioskOperatorSelect.value;
        if (!picked) {
          setPinStepVisible(false);
          updateKioskSubmitAvailability();
          return;
        }
        setPinStepVisible(true);
        if (kioskPinInput) kioskPinInput.focus();
        updateKioskSubmitAvailability();
      };

      kioskOperatorSelect.focus();
    }

    if (!operators || operators.length === 0) {
      setError('kiosk', 'Brak operatorów w tym pokoju. Upewnij się, że operator ma ustawiony pokój oraz włączony dostęp do kiosku.');
    }
  } catch (e) {
    console.error('Błąd ładowania operatorów kiosku:', e);
    setError('kiosk', e.message || 'Nie udało się pobrać operatorów.');
  } finally {
    kioskBusy = false;
    updateKioskSubmitAvailability();
  }
}

if (kioskForm) {
  kioskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError('kiosk', null);
    kioskBusy = true;
    setSubmitDisabled(kioskForm, true, 'Logowanie...');

    try {
      const roomId = getStoredRoomId();
      const userId = kioskOperatorSelect ? kioskOperatorSelect.value : null;
      const pin = kioskPinInput ? kioskPinInput.value : null;

      if (!roomId) {
        setError('kiosk', 'Wybierz pokój.');
        if (kioskRoomSelect) kioskRoomSelect.focus();
        return;
      }

      if (!userId) {
        setError('kiosk', 'Wybierz operatora.');
        if (kioskOperatorSelect) kioskOperatorSelect.focus();
        return;
      }

      const pinStr = (pin || '').toString().trim();
      if (!/^\d{6}$/.test(pinStr)) {
        setError('kiosk', 'PIN musi mieć 6 cyfr.');
        if (kioskPinInput) kioskPinInput.focus();
        return;
      }

      const response = await fetch('/api/kiosk/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, pin: pinStr }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.status !== 'success') {
        setError('kiosk', json.message || 'Nie udało się zalogować. Sprawdź PIN i spróbuj ponownie.');
        return;
      }

      const role = json?.data?.role;
      redirectAfterLogin(role);
    } catch (error) {
      console.error('Błąd logowania kiosku:', error);
      setError('kiosk', 'Błąd połączenia z serwerem. Spróbuj ponownie.');
    } finally {
      kioskBusy = false;
      updateKioskSubmitAvailability();
    }
  });
}

if (companyForm) {
  companyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError('company', null);
    setSubmitDisabled(companyForm, true, 'Logowanie...');

    const formData = new FormData(companyForm);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || json.status !== 'success') {
        setError('company', json.message || 'Nie udało się zalogować. Sprawdź dane i spróbuj ponownie.');
        return;
      }

      const role = json?.data?.role;
      redirectAfterLogin(role);
    } catch (error) {
      console.error('Błąd logowania firmowego:', error);
      setError('company', 'Błąd połączenia z serwerem. Spróbuj ponownie.');
    } finally {
      setSubmitDisabled(companyForm, false);
    }
  });
}

if (isKioskOnlyView) {
  document.body.classList.add('kiosk-only');
  const split = document.getElementById('login-split');
  if (split) split.classList.add('login-split--single');
  if (companyPanel) companyPanel.style.display = 'none';
  if (backToFormWrapper) backToFormWrapper.style.display = 'none';
  const tagline = document.getElementById('login-tagline');
  if (tagline) tagline.textContent = 'Logowanie na produkcji – wybierz pokój, operatora i wpisz PIN.';
}

initKioskMode().catch((e) => {
  console.error('Błąd inicjalizacji kiosku:', e);
  setError('kiosk', 'Nie udało się uruchomić kiosku.');
});
