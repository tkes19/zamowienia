const express = require('express');
const config = require('../config/env');
const { parseCookies } = require('../modules/auth');

const router = express.Router();
const GALLERY_BASE = config.GALLERY_BASE || 'http://rezon.myqnapcloud.com:81/home';

function ensureSupabase(req) {
  return req.app.locals.supabase || null;
}

async function proxyGalleryRequest(req, res, targetUrl, contextLabel) {
  try {
    console.log(`[${contextLabel}] Proxy request do:`, targetUrl);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const response = await fetch(targetUrl);
    const status = response.status;

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error(`Błąd parsowania JSON z galerii (${contextLabel}):`, parseError);
      return res.status(502).json({
        error: 'Invalid JSON from gallery backend',
        context: contextLabel
      });
    }

    let transformedData = data;
    if (contextLabel === 'salespeople' && !data.salesPeople && Array.isArray(data)) {
      transformedData = { salesPeople: data };
    } else if (contextLabel === 'cities' && !data.cities && Array.isArray(data)) {
      transformedData = { cities: data };
    } else if (contextLabel.startsWith('objects/') && !data.objects && Array.isArray(data)) {
      transformedData = { objects: data };
    }

    if (transformedData.files && Array.isArray(transformedData.files)) {
      transformedData.files = transformedData.files.map((file) => {
        if (file.url && file.url.includes('192.168.0.30')) {
          file.url = file.url.replace('http://192.168.0.30:81', 'http://rezon.myqnapcloud.com:81');
        }
        return file;
      });
    }

    return res.status(status).json(transformedData);
  } catch (error) {
    console.error(`Błąd proxy galerii (${contextLabel}):`, error);
    return res.status(502).json({
      error: 'Gallery proxy error',
      context: contextLabel,
      details: error.message
    });
  }
}

async function enrichGalleryProductsData(supabase, galleryData) {
  if (!supabase || !galleryData || typeof galleryData !== 'object') {
    return galleryData || {};
  }

  try {
    const slugSet = new Set();

    if (Array.isArray(galleryData.products)) {
      galleryData.products.forEach((slug) => {
        if (typeof slug === 'string') {
          const trimmed = slug.trim();
          if (trimmed) slugSet.add(trimmed);
        }
      });
    }

    if (Array.isArray(galleryData.files)) {
      galleryData.files.forEach((file) => {
        const slug = typeof (file && file.product) === 'string' ? file.product.trim() : '';
        if (slug) slugSet.add(slug);
      });
    }

    const slugs = Array.from(slugSet);
    if (!slugs.length) {
      return { ...galleryData, projects: [] };
    }

    const { data: existingProjects, error: existingError } = await supabase
      .from('GalleryProject')
      .select('id, slug, displayName')
      .in('slug', slugs);

    if (existingError) {
      console.error('Błąd pobierania istniejących projektów galerii:', existingError);
    }

    const existingSlugs = new Set((existingProjects || []).map((p) => p.slug));
    const missingSlugs = slugs.filter((slug) => !existingSlugs.has(slug));

    if (missingSlugs.length) {
      const nowIso = new Date().toISOString();
      const toInsert = missingSlugs.map((slug) => ({
        slug,
        displayName: slug.replace(/_/g, ' ').toUpperCase(),
        createdAt: nowIso
      }));

      const { error: insertError } = await supabase
        .from('GalleryProject')
        .insert(toInsert);

      if (insertError) {
        console.error('Błąd tworzenia nowych projektów galerii:', insertError);
      }
    }

    const { data: projectRows, error: projectsError } = await supabase
      .from('GalleryProject')
      .select('id, slug, displayName, GalleryProjectProduct:GalleryProjectProduct(productId)')
      .in('slug', slugs);

    if (projectsError) {
      console.error('Błąd pobierania mapowania projektów z Supabase:', projectsError);
      return { ...galleryData, projects: [] };
    }

    const productIdSet = new Set();
    (projectRows || []).forEach((row) => {
      (row.GalleryProjectProduct || []).forEach((rel) => {
        if (rel.productId) {
          productIdSet.add(rel.productId);
        }
      });
    });

    let productsById = {};
    if (productIdSet.size) {
      const { data: products, error: productsError } = await supabase
        .from('Product')
        .select('id, identifier, index, new, availability, isActive, Inventory(stock, location)')
        .in('id', Array.from(productIdSet));

      if (productsError) {
        console.error('Błąd pobierania produktów dla projektów galerii:', productsError);
      } else if (Array.isArray(products)) {
        productsById = Object.fromEntries(products.map((p) => [p.id, p]));
      }
    }

    const projects = Array.isArray(projectRows)
      ? projectRows
          .map((row) => {
            const relations = Array.isArray(row.GalleryProjectProduct)
              ? row.GalleryProjectProduct
              : [];

            const products = relations
              .map((rel) => {
                const prod = productsById[rel.productId];
                if (!prod) return null;

                const isNew = prod.new === true;
                const invArray = Array.isArray(prod.Inventory) ? prod.Inventory : [];
                const mainInventory = invArray.find((inv) => inv.location === 'MAIN') || null;
                const stock = Number(mainInventory?.stock || 0);
                const isAvailable = (prod.isActive !== false) && stock > 0;

                return {
                  id: prod.id,
                  identifier: prod.identifier || null,
                  index: prod.index || null,
                  new: isNew,
                  available: isAvailable
                };
              })
              .filter(Boolean);

            if (!products.length) {
              return null;
            }

            return {
              slug: row.slug,
              displayName: row.displayName,
              products
            };
          })
          .filter(Boolean)
      : [];

    return { ...galleryData, projects };
  } catch (error) {
    console.error('Błąd wzbogacania danych produktów galerii:', error);
    return { ...galleryData, projects: [] };
  }
}

router.get('/cities', async (req, res) => {
  const supabase = ensureSupabase(req);
  const cookies = parseCookies(req);
  const userId = cookies.auth_id;
  const userRole = cookies.auth_role;

  try {
    const phpResponse = await fetch(`${GALLERY_BASE}/list_cities.php`);
    if (!phpResponse.ok) {
      return res.status(phpResponse.status).json({ error: 'Błąd pobierania miejscowości z QNAP' });
    }
    const phpData = await phpResponse.json();
    const allCities = phpData.cities || [];

    if (userRole === 'ADMIN' || userRole === 'SALES_DEPT') {
      let assignedCities = [];
      if (userId && supabase) {
        const { data: assignments } = await supabase
          .from('UserCityAccess')
          .select('cityName')
          .eq('userId', userId)
          .eq('isActive', true);
        if (assignments?.length) {
          assignedCities = assignments.map((a) => a.cityName);
        }
      }
      return res.json({
        count: allCities.length,
        cities: allCities,
        filtered: false,
        assignedCities
      });
    }

    if (userId && supabase && (userRole === 'SALES_REP' || userRole === 'CLIENT')) {
      const { data: assignments } = await supabase
        .from('UserCityAccess')
        .select('cityName')
        .eq('userId', userId)
        .eq('isActive', true);

      if (assignments?.length) {
        const allowedCities = assignments.map((a) => a.cityName);
        return res.json({
          count: allCities.length,
          cities: allCities,
          filtered: true,
          totalAvailable: allCities.length,
          assignedCities: allowedCities,
          readOnly: false
        });
      }

      return res.json({
        count: allCities.length,
        cities: allCities,
        filtered: true,
        totalAvailable: allCities.length,
        assignedCities: [],
        readOnly: true,
        message: 'Brak przypisanych miejscowości. Skontaktuj się z działem handlowym.'
      });
    }

    return res.json({ count: allCities.length, cities: allCities, filtered: false });
  } catch (error) {
    console.error('Błąd w /api/gallery/cities:', error);
    return res.status(500).json({ error: 'Błąd serwera', details: error.message });
  }
});

router.get('/salespeople', async (req, res) => {
  const supabase = ensureSupabase(req);
  const cookies = parseCookies(req);
  const userId = cookies.auth_id;
  const userRole = cookies.auth_role;

  try {
    const phpResponse = await fetch(`${GALLERY_BASE}/list_salespeople.php`);
    if (!phpResponse.ok) {
      return res.status(phpResponse.status).json({ error: 'Błąd pobierania folderów z QNAP' });
    }
    const phpData = await phpResponse.json();
    const allFolders = phpData.salesPeople || [];

    if (userRole === 'ADMIN' || userRole === 'SALES_DEPT') {
      return res.json({ count: allFolders.length, salesPeople: allFolders, filtered: false });
    }

    if (userId && supabase && (userRole === 'SALES_REP' || userRole === 'CLIENT')) {
      const { data: assignments } = await supabase
        .from('UserFolderAccess')
        .select('folderName')
        .eq('userId', userId)
        .eq('isActive', true);

      if (assignments?.length) {
        const allowedFolders = assignments.map((a) => a.folderName);
        const filteredFolders = allFolders.filter((folder) => allowedFolders.includes(folder));
        return res.json({
          count: filteredFolders.length,
          salesPeople: filteredFolders,
          filtered: true,
          totalAvailable: allFolders.length
        });
      }

      return res.json({ count: 0, salesPeople: [], filtered: true, message: 'Brak przypisanych folderów KI' });
    }

    return res.json({ count: allFolders.length, salesPeople: allFolders, filtered: false });
  } catch (error) {
    console.error('Błąd w /api/gallery/salespeople:', error);
    return res.status(500).json({ error: 'Błąd serwera', details: error.message });
  }
});

router.get('/objects/:salesperson', async (req, res) => {
  const { salesperson } = req.params;
  const supabase = ensureSupabase(req);
  const cookies = parseCookies(req);
  const userId = cookies.auth_id;
  const userRole = cookies.auth_role;

  if (userRole !== 'ADMIN' && userRole !== 'SALES_DEPT') {
    if (userId && supabase && (userRole === 'SALES_REP' || userRole === 'CLIENT')) {
      const { data: assignment } = await supabase
        .from('UserFolderAccess')
        .select('id')
        .eq('userId', userId)
        .eq('folderName', salesperson)
        .eq('isActive', true)
        .single();

      if (!assignment) {
        return res.status(403).json({ error: 'Brak dostępu do tego folderu', folder: salesperson });
      }
    }
  }

  const targetUrl = `${GALLERY_BASE}/list_objects.php?salesperson=${encodeURIComponent(salesperson)}`;
  await proxyGalleryRequest(req, res, targetUrl, `objects/${salesperson}`);
});

router.get('/products/:city', async (req, res) => {
  const supabase = ensureSupabase(req);
  const { city } = req.params;
  const targetUrl = `${GALLERY_BASE}/list_products.php?city=${encodeURIComponent(city)}`;

  try {
    const response = await fetch(targetUrl);
    const status = response.status;

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Błąd parsowania JSON z list_products.php:', parseError);
      return res.status(502).json({
        error: 'Invalid JSON from gallery backend',
        context: `products/${city}`
      });
    }

    if (data && Array.isArray(data.files)) {
      data.files = data.files.map((file) => {
        if (file && typeof file.url === 'string' && file.url.includes('192.168.0.30')) {
          file.url = file.url.replace('http://192.168.0.30:81', 'http://rezon.myqnapcloud.com:81');
        }
        return file;
      });
    }

    const enriched = await enrichGalleryProductsData(supabase, data);
    return res.status(status).json(enriched);
  } catch (error) {
    console.error('Błąd pobierania produktów dla miasta z galerii:', error);
    return res.status(502).json({
      error: 'Gallery proxy error',
      context: `products/${city}`,
      details: error.message,
    });
  }
});

router.get('/products-object', async (req, res) => {
  const supabase = ensureSupabase(req);
  const { salesperson, object } = req.query;

  if (!salesperson || !object) {
    return res.status(400).json({ error: 'Brak wymaganych parametrów: salesperson, object' });
  }

  const url = `${GALLERY_BASE}/list_products_object.php?salesperson=${encodeURIComponent(salesperson)}&object=${encodeURIComponent(object)}`;

  try {
    const response = await fetch(url);
    const status = response.status;

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Błąd parsowania JSON z list_products_object.php:', parseError);
      return res.status(502).json({
        error: 'Invalid JSON from gallery backend',
        context: `products/${salesperson}/${object}`,
      });
    }

    if (data && Array.isArray(data.files)) {
      data.files = data.files.map((file) => {
        if (file && typeof file.url === 'string' && file.url.includes('192.168.0.30')) {
          file.url = file.url.replace('http://192.168.0.30:81', 'http://rezon.myqnapcloud.com:81');
        }
        return file;
      });
    }

    const enriched = await enrichGalleryProductsData(supabase, data);
    return res.status(status).json(enriched);
  } catch (error) {
    console.error('Błąd pobierania produktów dla obiektu z galerii:', error);
    return res.status(502).json({
      error: 'Gallery proxy error',
      context: `products/${salesperson}/${object}`,
      details: error.message,
    });
  }
});

router.get('/image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Brak parametru url' });
    }

    const galleryOrigin = new URL(GALLERY_BASE).origin;
    if (!imageUrl.startsWith(galleryOrigin)) {
      return res.status(400).json({ error: 'Nieprawidłowy adres obrazka' });
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Nie udało się pobrać obrazka z galerii',
        status: response.status,
        statusText: response.statusText,
      });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);

    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    console.error('Błąd proxy obrazka galerii:', error);
    res.status(502).json({
      error: 'Gallery image proxy error',
      details: error.message,
    });
  }
});

module.exports = router;
