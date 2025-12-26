const express = require('express');

const router = express.Router();

function ensureSupabase(req, res) {
  const supabase = req.app.locals.supabase;
  if (!supabase) {
    res.status(500).json({
      status: 'error',
      message: 'Supabase nie jest skonfigurowany. Ustaw SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY w backend/.env.'
    });
    return null;
  }
  return supabase;
}

router.get('/', async (req, res) => {
  const supabase = ensureSupabase(req, res);
  if (!supabase) return;

  const { search } = req.query;

  try {
    let query = supabase
      .from('Product')
      .select(`
        id,
        identifier,
        index,
        price,
        category,
        description,
        isActive,
        new,
        Inventory (
          stock,
          stockOptimal,
          stockOrdered,
          stockReserved,
          location
        )
      `)
      .eq('isActive', true)
      .order('identifier', { ascending: true });

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `identifier.ilike.${term},index.ilike.${term},description.ilike.${term}`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Błąd pobierania produktów z Supabase dla /api/v1/products:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Nie udało się pobrać produktów z bazy',
        details: error.message
      });
    }

    const products = (data || []).map((product) => {
      const invArray = Array.isArray(product.Inventory) ? product.Inventory : [];
      const mainInventory = invArray.find((inv) => inv.location === 'MAIN') || {};

      return {
        _id: product.id,
        name: product.identifier,
        pc_id: product.index,
        price: Number(product.price || 0),
        category: product.category,
        description: product.description || '',
        stock: Number(mainInventory.stock || 0),
        stock_optimal: Number(mainInventory.stockOptimal || 0),
        stock_ordered: Number(mainInventory.stockOrdered || 0),
        stock_reserved: Number(mainInventory.stockReserved || 0),
        isActive: product.isActive !== false,
        new: !!product.new
      };
    });

    return res.json({
      data: {
        products
      }
    });
  } catch (error) {
    console.error('Wyjątek w /api/v1/products (Supabase):', error);
    return res.status(500).json({
      status: 'error',
      message: 'Nie udało się pobrać produktów',
      error: error.message
    });
  }
});

module.exports = router;
