const express = require('express');
const { requireRole } = require('../modules/auth');

const router = express.Router();

const CLIENT_READ_ROLES = ['SALES_REP', 'SALES_DEPT', 'ADMIN', 'WAREHOUSE'];
const CLIENT_WRITE_ROLES = ['SALES_REP', 'SALES_DEPT', 'ADMIN'];

function ensureSupabase(req, res) {
  const supabase = req.app.locals.supabase;
  if (!supabase) {
    res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    return null;
  }
  return supabase;
}

// GET /api/clients
router.get('/', requireRole(CLIENT_READ_ROLES), async (req, res) => {
  const supabase = ensureSupabase(req, res);
  if (!supabase) return;

  const { role, id: userId } = req.user;
  const { search } = req.query;

  try {
    let query = supabase.from('Customer').select(`
      id,
      name,
      email,
      phone,
      address,
      city,
      zipCode,
      country,
      notes,
      salesRepId,
      createdAt,
      updatedAt
    `);

    if (role === 'SALES_REP') {
      query = query.eq('salesRepId', userId);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `name.ilike.${term},email.ilike.${term},phone.ilike.${term},city.ilike.${term}`
      );
    }

    query = query.order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Błąd pobierania klientów:', error);
      return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać klientów', details: error.message });
    }

    let enrichedData = data || [];
    if (['ADMIN', 'SALES_DEPT'].includes(role) && enrichedData.length > 0) {
      const salesRepIds = [...new Set(enrichedData.map(c => c.salesRepId).filter(Boolean))];

      if (salesRepIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('User')
          .select('id, name')
          .in('id', salesRepIds);

        if (!usersError && users) {
          const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));
          enrichedData = enrichedData.map(c => ({
            ...c,
            salesRepName: c.salesRepId ? userMap[c.salesRepId] || 'Nieznany' : null
          }));
        }
      }
    }

    return res.json({ status: 'success', data: enrichedData });
  } catch (err) {
    console.error('Wyjątek w GET /api/clients:', err);
    return res.status(500).json({ status: 'error', message: 'Błąd podczas pobierania klientów', details: err.message });
  }
});

// POST /api/clients
router.post('/', requireRole(CLIENT_WRITE_ROLES), async (req, res) => {
  const supabase = ensureSupabase(req, res);
  if (!supabase) return;

  const { role, id: userId } = req.user;
  const { name, email, phone, address, city, zipCode, country, notes, salesRepId } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ status: 'error', message: 'Nazwa klienta jest wymagana' });
  }

  try {
    const clientData = {
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      city: city?.trim() || null,
      zipCode: zipCode?.trim() || null,
      country: country?.trim() || 'Poland',
      notes: notes?.trim() || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (role === 'SALES_REP') {
      clientData.salesRepId = userId;
    } else if (['ADMIN', 'SALES_DEPT'].includes(role)) {
      clientData.salesRepId = salesRepId || userId;
    }

    const { data, error } = await supabase
      .from('Customer')
      .insert(clientData)
      .select('*')
      .single();

    if (error) {
      console.error('Błąd tworzenia klienta:', error);
      return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć klienta', details: error.message });
    }

    return res.status(201).json({ status: 'success', data });
  } catch (err) {
    console.error('Wyjątek w POST /api/clients:', err);
    return res.status(500).json({ status: 'error', message: 'Błąd podczas tworzenia klienta', details: err.message });
  }
});

// PATCH /api/clients/:id
router.patch('/:id', requireRole(CLIENT_WRITE_ROLES), async (req, res) => {
  const supabase = ensureSupabase(req, res);
  if (!supabase) return;

  const { role, id: userId } = req.user;
  const { id } = req.params;
  const { name, email, phone, address, city, zipCode, country, notes, salesRepId } = req.body || {};

  try {
    let clientQuery = supabase.from('Customer').select('id, salesRepId').eq('id', id);

    if (role === 'SALES_REP') {
      clientQuery = clientQuery.eq('salesRepId', userId);
    }

    const { data: existingClient, error: fetchError } = await clientQuery.single();

    if (fetchError || !existingClient) {
      return res.status(404).json({ status: 'error', message: 'Klient nie znaleziony lub brak uprawnień' });
    }

    const updateData = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (zipCode !== undefined) updateData.zipCode = zipCode?.trim() || null;
    if (country !== undefined) updateData.country = country?.trim() || 'Poland';
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    if (['ADMIN', 'SALES_DEPT'].includes(role) && salesRepId !== undefined) {
      updateData.salesRepId = salesRepId;
    }

    const { data, error } = await supabase
      .from('Customer')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Błąd aktualizacji klienta:', error);
      return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować klienta', details: error.message });
    }

    return res.json({ status: 'success', data });
  } catch (err) {
    console.error('Wyjątek w PATCH /api/clients/:id:', err);
    return res.status(500).json({ status: 'error', message: 'Błąd podczas aktualizacji klienta', details: err.message });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', requireRole(CLIENT_WRITE_ROLES), async (req, res) => {
  const supabase = ensureSupabase(req, res);
  if (!supabase) return;

  const { role, id: userId } = req.user;
  const { id } = req.params;

  try {
    let clientQuery = supabase.from('Customer').select('id, name, salesRepId').eq('id', id);

    if (role === 'SALES_REP') {
      clientQuery = clientQuery.eq('salesRepId', userId);
    }

    const { data: existingClient, error: fetchError } = await clientQuery.single();

    if (fetchError || !existingClient) {
      return res.status(404).json({ status: 'error', message: 'Klient nie znaleziony lub brak uprawnień' });
    }

    const { data: orders } = await supabase
      .from('Order')
      .select('id')
      .eq('customerId', id)
      .limit(1);

    if (orders && orders.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Nie można usunąć klienta, który ma zamówienia. Dezaktywuj go zamiast tego.'
      });
    }

    const { error } = await supabase
      .from('Customer')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Błąd usuwania klienta:', error);
      return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć klienta', details: error.message });
    }

    return res.json({ status: 'success', message: `Klient "${existingClient.name}" został usunięty` });
  } catch (err) {
    console.error('Wyjątek w DELETE /api/clients/:id:', err);
    return res.status(500).json({ status: 'error', message: 'Błąd podczas usuwania klienta', details: err.message });
  }
});

module.exports = router;
