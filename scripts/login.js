const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');

function setError(message) {
  if (!errorEl) return;
  if (!message) {
    errorEl.hidden = true;
    errorEl.textContent = '';
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = message;
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError(null);

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
    }

    const formData = new FormData(form);
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
        setError(json.message || 'Nie udało się zalogować. Sprawdź dane i spróbuj ponownie.');
        return;
      }

      const role = json?.data?.role;

      // ADMIN → panel admina, reszta → główny formularz zamówień
      if (role === 'ADMIN') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Błąd logowania:', error);
      setError('Błąd połączenia z serwerem. Spróbuj ponownie.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  });
}
