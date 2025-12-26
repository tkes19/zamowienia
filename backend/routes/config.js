const express = require('express');
const { requireRole } = require('../modules/auth');

const router = express.Router();

// Public presets for order delivery form
router.get('/order-delivery-presets', async (req, res) => {
  const supabase = req.app.locals.supabase;

  if (!supabase) {
    return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
  }

  try {
    const { data, error } = await supabase
      .from('OrderDeliveryPreset')
      .select('id, label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder')
      .eq('isActive', true)
      .order('sortOrder', { ascending: true })
      .order('offsetDays', { ascending: true });

    if (error) {
      console.error('Błąd pobierania OrderDeliveryPreset (config):', error);
      return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać presetów terminów dostawy', details: error.message });
    }

    const presets = Array.isArray(data) ? data : [];
    const defaultPreset = presets.find((p) => p && p.isDefault) || null;

    return res.json({
      status: 'success',
      data: presets,
      defaultPreset,
    });
  } catch (err) {
    console.error('Wyjątek w GET /api/config/order-delivery-presets:', err);
    return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
  }
});

// Admin: list presets (moved to admin router)
// This endpoint should be in routes/admin.js
router.get('/admin/order-delivery-presets', requireRole(['ADMIN']), async (req, res) => {
  const supabase = req.app.locals.supabase;

  if (!supabase) {
    return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
  }

  try {
    const { data, error } = await supabase
      .from('OrderDeliveryPreset')
      .select('id, label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder, createdAt, updatedAt')
      .order('sortOrder', { ascending: true })
      .order('offsetDays', { ascending: true });

    if (error) {
      console.error('Błąd pobierania OrderDeliveryPreset (admin):', error);
      return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać presetów terminów dostawy', details: error.message });
    }

    return res.json({ status: 'success', data: data || [], count: data?.length || 0 });
  } catch (err) {
    console.error('Wyjątek w GET /api/admin/order-delivery-presets:', err);
    return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
  }
});

// Admin: create preset
router.post('/admin/order-delivery-presets', requireRole(['ADMIN']), async (req, res) => {
  const supabase = req.app.locals.supabase;

  if (!supabase) {
    return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
  }

  const { label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder } = req.body || {};

  if (!label || typeof label !== 'string' || !label.trim()) {
    return res.status(400).json({ status: 'error', message: 'label jest wymagane' });
  }

  const normalizedMode = (typeof mode === 'string' && mode.trim()) ? mode.trim().toUpperCase() : 'OFFSET';
  const finalMode = ['OFFSET', 'FIXED_DATE'].includes(normalizedMode) ? normalizedMode : 'OFFSET';

  let normalizedOffset = 0;
  let normalizedFixedDate = null;

  if (finalMode === 'OFFSET') {
    normalizedOffset = Number(offsetDays);
    if (!Number.isFinite(normalizedOffset)) {
      return res.status(400).json({ status: 'error', message: 'offsetDays musi być liczbą dla trybu OFFSET' });
    }
  } else {
    if (!fixedDate || typeof fixedDate !== 'string' || !fixedDate.trim()) {
      return res.status(400).json({ status: 'error', message: 'fixedDate jest wymagane dla trybu FIXED_DATE (format YYYY-MM-DD)' });
    }

    const parsed = new Date(fixedDate);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ status: 'error', message: 'fixedDate ma nieprawidłowy format (oczekiwany: YYYY-MM-DD)' });
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    normalizedFixedDate = `${year}-${month}-${day}`;

    if (offsetDays === undefined || offsetDays === null) {
      normalizedOffset = 0;
    } else {
      const maybeOffset = Number(offsetDays);
      normalizedOffset = Number.isFinite(maybeOffset) ? maybeOffset : 0;
    }
  }

  const normalizedSortOrder = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;
  const nowIso = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('OrderDeliveryPreset')
      .insert({
        label: label.trim(),
        offsetDays: normalizedOffset,
        mode: finalMode,
        fixedDate: normalizedFixedDate,
        isDefault: !!isDefault,
        isActive: isActive === undefined ? true : !!isActive,
        sortOrder: normalizedSortOrder,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .select()
      .single();

    if (error) {
      console.error('Błąd tworzenia OrderDeliveryPreset:', error);
      return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć preset-u terminu dostawy', details: error.message });
    }

    if (data && data.isDefault) {
      try {
        await supabase
          .from('OrderDeliveryPreset')
          .update({ isDefault: false, updatedAt: new Date().toISOString() })
          .neq('id', data.id)
          .eq('isDefault', true);
      } catch (updateErr) {
        console.error('Błąd aktualizacji flag isDefault (po INSERT):', updateErr);
      }
    }

    return res.status(201).json({ status: 'success', data, message: 'Preset terminu dostawy utworzony' });
  } catch (err) {
    console.error('Wyjątek w POST /api/admin/order-delivery-presets:', err);
    return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
  }
});

// Admin: update preset
router.patch('/admin/order-delivery-presets/:id', requireRole(['ADMIN']), async (req, res) => {
  const supabase = req.app.locals.supabase;

  if (!supabase) {
    return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
  }

  const { id } = req.params;
  const { label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder } = req.body || {};

  try {
    const { data: current, error: currentError } = await supabase
      .from('OrderDeliveryPreset')
      .select('id, label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder')
      .eq('id', id)
      .single();

    if (currentError || !current) {
      return res.status(404).json({ status: 'error', message: 'Preset terminu dostawy nie znaleziony' });
    }

    const updateData = { updatedAt: new Date().toISOString() };

    if (label !== undefined) {
      if (!label || typeof label !== 'string' || !label.trim()) {
        return res.status(400).json({ status: 'error', message: 'label nie może być puste' });
      }
      updateData.label = label.trim();
    }

    if (offsetDays !== undefined) {
      const normalizedOffset = Number(offsetDays);
      if (!Number.isFinite(normalizedOffset)) {
        return res.status(400).json({ status: 'error', message: 'offsetDays musi być liczbą' });
      }
      updateData.offsetDays = normalizedOffset;
    }

    if (mode !== undefined) {
      if (typeof mode !== 'string' || !mode.trim()) {
        return res.status(400).json({ status: 'error', message: 'mode musi być niepustym stringiem' });
      }
      const normalizedMode = mode.trim().toUpperCase();
      if (!['OFFSET', 'FIXED_DATE'].includes(normalizedMode)) {
        return res.status(400).json({ status: 'error', message: 'mode musi być jednym z: OFFSET, FIXED_DATE' });
      }
      updateData.mode = normalizedMode;
      if (normalizedMode === 'OFFSET' && fixedDate === undefined) {
        updateData.fixedDate = null;
      }
    }

    if (fixedDate !== undefined) {
      if (fixedDate === null || fixedDate === '') {
        updateData.fixedDate = null;
      } else if (typeof fixedDate === 'string') {
        const parsed = new Date(fixedDate);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ status: 'error', message: 'fixedDate ma nieprawidłowy format (oczekiwany: YYYY-MM-DD)' });
        }
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        updateData.fixedDate = `${year}-${month}-${day}`;
      } else {
        return res.status(400).json({ status: 'error', message: 'fixedDate musi być stringiem lub null' });
      }
    }

    if (isDefault !== undefined) {
      updateData.isDefault = !!isDefault;
    }

    if (isActive !== undefined) {
      updateData.isActive = !!isActive;
    }

    if (sortOrder !== undefined) {
      const normalizedSortOrder = Number(sortOrder);
      if (!Number.isFinite(normalizedSortOrder)) {
        return res.status(400).json({ status: 'error', message: 'sortOrder musi być liczbą' });
      }
      updateData.sortOrder = normalizedSortOrder;
    }

    const { data, error } = await supabase
      .from('OrderDeliveryPreset')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Błąd aktualizacji OrderDeliveryPreset:', error);
      return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować preset-u terminu dostawy', details: error.message });
    }

    if (data && data.isDefault) {
      try {
        await supabase
          .from('OrderDeliveryPreset')
          .update({ isDefault: false, updatedAt: new Date().toISOString() })
          .neq('id', data.id)
          .eq('isDefault', true);
      } catch (updateErr) {
        console.error('Błąd aktualizacji flag isDefault (po PATCH):', updateErr);
      }
    }

    return res.json({ status: 'success', data, message: 'Preset terminu dostawy zaktualizowany' });
  } catch (err) {
    console.error('Wyjątek w PATCH /api/admin/order-delivery-presets/:id:', err);
    return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
  }
});

// Admin: delete preset
router.delete('/admin/order-delivery-presets/:id', requireRole(['ADMIN']), async (req, res) => {
  const supabase = req.app.locals.supabase;

  if (!supabase) {
    return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
  }

  const { id } = req.params;

  try {
    const { error } = await supabase.from('OrderDeliveryPreset').delete().eq('id', id);

    if (error) {
      console.error('Błąd usuwania OrderDeliveryPreset:', error);
      return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć preset-u terminu dostawy', details: error.message });
    }

    return res.json({ status: 'success', message: 'Preset terminu dostawy usunięty' });
  } catch (err) {
    console.error('Wyjątek w DELETE /api/admin/order-delivery-presets/:id:', err);
    return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
  }
});

module.exports = router;
