const express = require('express');
const { requireRole } = require('../modules/auth');

const router = express.Router();
const MAX_FAVORITES = 12;

function ensureSupabase(req, res) {
  const supabase = req.app.locals.supabase;
  if (!supabase) {
    res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    return null;
  }
  return supabase;
}

router.get('/', requireRole(['ADMIN','SALES_DEPT','SALES_REP','WAREHOUSE','PRODUCTION','GRAPHICS','GRAPHIC_DESIGNER','PRODUCTION_MANAGER','CLIENT']), async (req, res) => {
  const supabase = ensureSupabase(req, res);
  if (!supabase) return;

  const userId = req.user?.id;
  const { type } = req.query;

  if (!userId) {
    return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
  }

  try {
    let query = supabase
      .from('UserFavorites')
      .select('id, type, itemId, displayName, metadata, createdAt')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Błąd pobierania ulubionych:', error);
      return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać ulubionych', details: error.message });
    }

    return res.json({ status: 'success', data: data || [], count: data?.length || 0 });
  } catch (err) {
    console.error('Wyjątek w GET /api/favorites:', err);
    return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
  }
});

router.post('/', requireRole(['ADMIN','SALES_DEPT','SALES_REP','WAREHOUSE','PRODUCTION','GRAPHICS','GRAPHIC_DESIGNER','PRODUCTION_MANAGER','CLIENT']), async (req, res) => {
  const supabase = ensureSupabase(req, res);
  if (!supabase) return;

  const userId = req.user?.id;
  const { type, itemId, displayName, metadata } = req.body || {};

  if (!userId) {
    return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
  }
  if (!type || !itemId || !displayName) {
    return res.status(400).json({ status: 'error', message: 'type, itemId i displayName są wymagane' });
  }
  if (!['city', 'ki_object'].includes(type)) {
    return res.status(400).json({ status: 'error', message: 'Nieprawidłowy typ: dozwolone city lub ki_object' });
  }

  try {
    const { count, error: countError } = await supabase
      .from('UserFavorites')
      .select('id', { count: 'exact', head: true })
      .eq('userId', userId)
      .eq('type', type);

    if (countError) {
      console.error('Błąd liczenia ulubionych:', countError);
    } else if (count >= MAX_FAVORITES) {
      return res.status(400).json({ status: 'error', message: `Osiągnięto limit ${MAX_FAVORITES} ulubionych pozycji dla tego typu` });
    }

    const { data: existing } = await supabase
      .from('UserFavorites')
      .select('id')
      .eq('userId', userId)
      .eq('type', type)
      .eq('itemId', itemId)
      .single();

    if (existing) {
      return res.status(409).json({ status: 'error', message: 'Ta pozycja jest już w ulubionych' });
    }

    const { data, error } = await supabase
      .from('UserFavorites')
      .insert({
        userId,
        type,
        itemId,
        displayName,
        metadata: metadata || null,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Błąd dodawania do ulubionych:', error);
      return res.status(500).json({ status: 'error', message: 'Nie udało się dodać do ulubionych', details: error.message });
    }

    return res.status(201).json({ status: 'success', data, message: 'Dodano do ulubionych' });
  } catch (err) {
    console.error('Wyjątek w POST /api/favorites:', err);
    return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
  }
});

router.delete('/:type/:itemId', requireRole(['ADMIN','SALES_DEPT','SALES_REP','WAREHOUSE','PRODUCTION','GRAPHICS','GRAPHIC_DESIGNER','PRODUCTION_MANAGER','CLIENT']), async (req, res) => {
  const supabase = ensureSupabase(req, res);
  if (!supabase) return;

  const userId = req.user?.id;
  const { type, itemId } = req.params;

  if (!userId) {
    return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
  }

  try {
    const { error } = await supabase
      .from('UserFavorites')
      .delete()
      .eq('userId', userId)
      .eq('type', type)
      .eq('itemId', decodeURIComponent(itemId));

    if (error) {
      console.error('Błąd usuwania z ulubionych:', error);
      return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć z ulubionych', details: error.message });
    }

    return res.json({ status: 'success', message: 'Usunięto z ulubionych' });
  } catch (err) {
    console.error('Wyjątek w DELETE /api/favorites:', err);
    return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
  }
});

module.exports = router;
