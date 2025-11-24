require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto'); // Dodano import crypto
const { createClient } = require('@supabase/supabase-js');
const { createPdf } = require('./pdfGenerator');

const app = express();
const PORT = process.env.PORT || 3001;
const GALLERY_BASE = process.env.GALLERY_BASE || 'http://rezon.myqnapcloud.com:81/home';

// Konfiguracja Supabase – wartości muszą być ustawione w backend/.env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_TABLE_PRODUCTS = process.env.SUPABASE_TABLE_PRODUCTS || 'products';

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} else {
  console.warn('Supabase nie jest skonfigurowany – brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env');
}

// Serwowanie plików statycznych z folderu nadrzędnego
app.use(express.static(path.join(__dirname, '..')));

// Konfiguracja CORS
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Middleware do parsowania JSON
app.use(express.json({ limit: '10mb' }));

// Główna ścieżka - serwowanie pliku index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Test endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Serwer działa poprawnie' });
});

// Test połączenia z Supabase – proste zapytanie do tabeli produktów
app.get('/api/supabase/health', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({
            status: 'error',
            message: 'Supabase nie jest skonfigurowany. Ustaw SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY w backend/.env.',
        });
    }

    try {
        const { data, error } = await supabase
            .from(SUPABASE_TABLE_PRODUCTS)
            .select('*')
            .limit(1);

        if (error) {
            console.error('Błąd Supabase:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd zapytania do Supabase', details: error.message });
        }

        return res.json({
            status: 'OK',
            table: SUPABASE_TABLE_PRODUCTS,
            rowCount: Array.isArray(data) ? data.length : 0,
        });
    } catch (err) {
        console.error('Wyjątek Supabase:', err);
        return res.status(500).json({ status: 'error', message: 'Wyjątek podczas łączenia z Supabase', details: err.message });
    }
});

// Proxy endpoint do pobierania produktów
app.get('/api/v1/products', async (req, res) => {
    try {
        const { search } = req.query;
        let apiUrl = 'https://rezon-api.vercel.app/api/v1/products';
        
        if (search) {
            apiUrl += `?search=${encodeURIComponent(search)}`;
        }
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Błąd podczas pobierania produktów:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się pobrać produktów',
            error: error.message 
        });
    }
});

// Proste proxy do galerii (QNAP) – wszystkie zapytania idą przez backend

async function proxyGalleryRequest(req, res, targetUrl, contextLabel) {
    try {
        console.log(`[${contextLabel}] Proxy request do:`, targetUrl);
        
        // Ustawiamy nagłówki CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        // Obsługa zapytań OPTIONS (preflight)
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
                context: contextLabel,
            });
        }

        // Transform the response data to match frontend expectations
        let transformedData = data;
        
        // If this is a salespeople request, ensure the response has a salesPeople array
        if (contextLabel === 'salespeople' && !data.salesPeople && Array.isArray(data)) {
            transformedData = { salesPeople: data };
        }
        // If this is a cities request, ensure the response has a cities array
        else if (contextLabel === 'cities' && !data.cities && Array.isArray(data)) {
            transformedData = { cities: data };
        }
        // If this is an objects request, ensure the response has an objects array
        else if (contextLabel.startsWith('objects/') && !data.objects && Array.isArray(data)) {
            transformedData = { objects: data };
        }
        
        // Transform URL-y obrazków z lokalnego IP na publiczny adres
        if (transformedData.files && Array.isArray(transformedData.files)) {
            transformedData.files = transformedData.files.map(file => {
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
            details: error.message,
        });
    }
}

// Lista miejscowości
app.get('/api/gallery/cities', async (req, res) => {
    await proxyGalleryRequest(req, res, `${GALLERY_BASE}/list_cities.php`, 'cities');
});

// Lista handlowców
app.get('/api/gallery/salespeople', async (req, res) => {
    await proxyGalleryRequest(req, res, `${GALLERY_BASE}/list_salespeople.php`, 'salespeople');
});

// Lista obiektów dla handlowca
app.get('/api/gallery/objects/:salesperson', async (req, res) => {
    const { salesperson } = req.params;
    console.log('Pobieranie obiektów dla handlowca:', salesperson);
    const targetUrl = `${GALLERY_BASE}/list_objects.php?salesperson=${encodeURIComponent(salesperson)}`;
    console.log('URL do QNAP:', targetUrl);
    await proxyGalleryRequest(req, res, targetUrl, `objects/${salesperson}`);
});

// Lista produktów dla miejscowości
app.get('/api/gallery/products/:city', async (req, res) => {
    const { city } = req.params;
    console.log('Pobieranie produktów dla miasta:', city);
    const targetUrl = `${GALLERY_BASE}/list_products.php?city=${encodeURIComponent(city)}`;
    console.log('URL do QNAP:', targetUrl);
    await proxyGalleryRequest(req, res, targetUrl, `products/${city}`);
});

// Lista produktów dla obiektu (handlowiec + obiekt)
app.get('/api/gallery/products-object', async (req, res) => {
    const { salesperson, object } = req.query;
    if (!salesperson || !object) {
        return res.status(400).json({ error: 'Brak wymaganych parametrów: salesperson, object' });
    }
    console.log('Pobieranie produktów dla obiektu:', salesperson, object);
    const url = `${GALLERY_BASE}/list_products_object.php?salesperson=${encodeURIComponent(salesperson)}&object=${encodeURIComponent(object)}`;
    console.log('URL do QNAP:', url);
    await proxyGalleryRequest(req, res, url, `products/${salesperson}/${object}`);
});

// Proxy dla obrazków z galerii – żeby uniknąć mixed content (HTTPS → HTTP)
app.get('/api/gallery/image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).json({ error: 'Brak parametru url' });
        }

        // Nie pozwalamy proxy’ować czegokolwiek – tylko zasoby z GALLERY_BASE
        if (!imageUrl.startsWith(GALLERY_BASE)) {
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

// Email configuration
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Send order via email
app.post('/api/orders/send', async (req, res) => {
    try {
        const { orderData, fileName = 'zamowienie' } = req.body;
        
        if (!orderData || !orderData.length) {
            return res.status(400).json({ error: 'Brak danych zamówienia' });
        }

        // Generate PDF
        const pdfBuffer = await createPdf(orderData, fileName);

        // Send email with PDF attachment
        const info = await transporter.sendMail({
            from: `"Formularz Zamówień" <${process.env.EMAIL_FROM}>`,
            to: process.env.EMAIL_TO,
            subject: `Nowe zamówienie - ${new Date().toLocaleDateString('pl-PL')}`,
            text: 'W załączniku znajdziesz szczegóły zamówienia.',
            html: `
                <h2>Nowe zamówienie</h2>
                <p>Data: ${new Date().toLocaleString('pl-PL')}</p>
                <p>Liczba pozycji: ${orderData.length}</p>
                <p>Szczegóły w załączonym pliku PDF.</p>
            `,
            attachments: [{
                filename: `${fileName}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        });

        console.log('Wysłano email z zamówieniem:', info.messageId);
        res.json({ 
            success: true, 
            message: 'Zamówienie zostało wysłane',
            messageId: info.messageId 
        });
    } catch (error) {
        console.error('Błąd podczas wysyłania zamówienia:', error);
        res.status(500).json({ 
            error: 'Błąd podczas wysyłania zamówienia',
            details: error.message 
        });
    }
});

// Mapowanie kategorii z API Rezon na ENUM w Supabase
const CATEGORY_MAPPING = {
    'akcesoria podróżne': 'AKCESORIA_PODROZNE',
    'artykuły biurowe': 'DLUGOPISY', // mapowanie na DLUGOPISY jak w starym systemie lub ARTYKULY_BIUROWE jeśli istnieje
    'breloki': 'BRELOKI',
    'gadżety domowe': 'OZDOBY_DOMOWE',
    'kubki i szklanki': 'CERAMIKA_I_SZKLO',
    'magnesy': 'MAGNESY',
    'odzież': 'TEKSTYLIA',
    'parasole': 'AKCESORIA_PODROZNE',
    'prezenty świąteczne': 'UPOMINKI_BIZNESOWE',
    'torby i plecaki': 'TEKSTYLIA',
    'bransoletki': 'BRANSOLETKI',
    'ceramika i szkło': 'CERAMIKA_I_SZKLO',
    'czapki i nakrycia głowy': 'CZAPKI_I_NAKRYCIA_GLOWY',
    'do auta': 'AKCESORIA_PODROZNE',
    'dziecięce': 'DLA_DZIECI',
    'długopisy': 'DLUGOPISY',
    'otwieracze': 'OTWIERACZE',
    'ozdoby domowe': 'OZDOBY_DOMOWE',
    'tekstylia': 'TEKSTYLIA',
    'upominki biznesowe': 'UPOMINKI_BIZNESOWE',
    'zapalniczki i popielniczki': 'ZAPALNICZKI_I_POPIELNICZKI',
    'zestawy': 'ZESTAWY'
};

// Endpoint do synchronizacji z zewnętrznym API
app.post('/api/admin/sync-from-external-api', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        console.log('🚀 Rozpoczynam synchronizację z zewnętrznym API...');
        
        // 1. Pobierz produkty z API
        const response = await fetch('https://rezon-api.vercel.app/api/v1/products');
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const apiData = await response.json();
        const apiProducts = apiData.data?.products || [];
        
        console.log(`📦 Pobrano ${apiProducts.length} produktów z API`);
        
        let stats = { processed: 0, updated: 0, errors: 0 };
        
        // 2. Przetwarzamy produkty (można to zoptymalizować robiąc batch, ale pętla jest bezpieczniejsza na start)
        for (const apiProd of apiProducts) {
            try {
                // Pomijamy produkty bez nazwy/id
                if (!apiProd.name && !apiProd.pc_id) continue;

                const identifier = apiProd.name || apiProd.pc_id;
                const index = apiProd.pc_id || apiProd.name;
                
                // Mapowanie kategorii
                const rawCat = (apiProd.category || '').toLowerCase();
                const mappedCat = CATEGORY_MAPPING[rawCat] || 'INNE'; // Fallback category

                // Konstrukcja URL obrazka
                let imageUrl = null;
                if (apiProd.imageCover) {
                    imageUrl = apiProd.imageCover.startsWith('http') 
                        ? apiProd.imageCover 
                        : `https://www.rezon.eu${apiProd.imageCover}`;
                }

                // A. Upsert Produktu
                // W Supabase upsert działa na podstawie Primary Key lub kolumny z constraintem UNIQUE.
                // W schemacie mamy: constraint Product_identifier_key unique (identifier)
                
                // Najpierw sprawdzamy czy produkt istnieje po identifier, żeby pobrać jego ID
                const { data: existingProd } = await supabase
                    .from('Product')
                    .select('id')
                    .eq('identifier', identifier)
                    .single();

                let productId = existingProd?.id;

                const productData = {
                    identifier: identifier,
                    index: index,
                    name: identifier, // W starym systemie name to identifier
                    description: apiProd.description || '',
                    price: apiProd.price || 0,
                    category: mappedCat,
                    isActive: apiProd.active !== false,
                    new: apiProd.new === true, // Dodano obsługę flagi NOWOŚĆ
                    imageUrl: imageUrl,
                    // images: ... (można dodać później)
                    updatedAt: new Date().toISOString()
                };

                if (productId) {
                    // Update
                    await supabase.from('Product').update(productData).eq('id', productId);
                } else {
                    // Insert
                    const { data: newProd, error: insertError } = await supabase
                        .from('Product')
                        .insert(productData)
                        .select('id')
                        .single();
                    
                    if (insertError) throw insertError;
                    productId = newProd.id;
                }

                // B. Aktualizacja Inventory (Check -> Update/Insert)
                // Tabela Inventory wymaga ID, a upsert bez ID wyrzuca błąd, bo kolumna nie ma default value.
                
                // Sprawdź czy istnieje wpis magazynowy
                const { data: existingInv } = await supabase
                    .from('Inventory')
                    .select('id')
                    .eq('productId', productId)
                    .eq('location', 'MAIN')
                    .single();

                const inventoryData = {
                    stock: apiProd.stock || 0,
                    stockOptimal: apiProd.stock_optimal || 0,
                    stockOrdered: apiProd.stock_ordered || 0,
                    updatedAt: new Date().toISOString()
                };

                if (existingInv) {
                    // Update istniejącego
                    const { error: updateErr } = await supabase
                        .from('Inventory')
                        .update(inventoryData)
                        .eq('id', existingInv.id);
                    
                    if (updateErr) throw updateErr;
                } else {
                    // Insert nowego (generujemy ID ręcznie)
                    const newInventoryData = {
                        id: crypto.randomUUID(),
                        productId: productId,
                        location: 'MAIN',
                        stockReserved: 0,
                        reorderPoint: 0,
                        ...inventoryData
                    };
                    
                    const { error: insertErr } = await supabase
                        .from('Inventory')
                        .insert(newInventoryData);
                        
                    if (insertErr) throw insertErr;
                }

                stats.processed++;
                stats.updated++;

            } catch (err) {
                console.error(`Błąd przy produkcie ${apiProd.name}:`, err.message);
                stats.errors++;
            }
        }

        console.log(`✅ Synchronizacja zakończona.`, stats);
        return res.json({
            status: 'success',
            message: `Zsynchronizowano ${stats.updated} produktów`,
            stats
        });

    } catch (error) {
        console.error('Global sync error:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd synchronizacji',
            details: error.message 
        });
    }
});

// Endpoint dla panelu admina - lista produktów ze stanami magazynowymi
app.get('/api/admin/products-with-stock', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        console.log('Pobieranie produktów ze stanami magazynowymi...');
        
        // Pobieramy produkty i łączymy z Inventory
        // Uwaga: W Supabase relacja musi być zdefiniowana. 
        // Jeśli nazwy tabel są wielką literą ("Product", "Inventory"), używamy cudzysłowów w zapytaniu SQL, 
        // ale w JS client library zazwyczaj podajemy nazwy stringami.
        // Sprawdzimy czy to zadziała z domyślnymi nazwami.
        
        const { data, error } = await supabase
            .from('Product')
            .select(`
                *,
                Inventory (
                    stock,
                    stockOptimal,
                    stockOrdered,
                    stockReserved,
                    location
                )
            `)
            .order('name', { ascending: true });

        if (error) {
            console.error('Błąd pobierania produktów z Supabase:', error);
            throw error;
        }

        // Przetwarzamy dane, aby łatwiej wyświetlać je na froncie
        // Inventory jest tablicą (bo relacja 1:N), ale interesuje nas głównie location='MAIN'
        const processedData = data.map(product => {
            const mainInventory = product.Inventory && Array.isArray(product.Inventory) 
                ? product.Inventory.find(inv => inv.location === 'MAIN') 
                : null;

            return {
                ...product,
                // Spłaszczamy dane magazynowe do obiektu produktu dla wygody
                stock: mainInventory?.stock || 0,
                stockOptimal: mainInventory?.stockOptimal || 0,
                stockOrdered: mainInventory?.stockOrdered || 0,
                stockReserved: mainInventory?.stockReserved || 0,
                hasInventory: !!mainInventory
            };
        });

        console.log(`Pobrano ${processedData.length} produktów.`);
        
        return res.json({
            status: 'success',
            data: processedData
        });

    } catch (err) {
        console.error('Wyjątek w /api/admin/products-with-stock:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd podczas pobierania danych magazynowych',
            details: err.message 
        });
    }
});

// -----------------------------
// Admin API - CRUD dla Product
// -----------------------------

// Pobierz pojedynczy produkt
app.get('/api/admin/products/:id', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('Product')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Błąd pobierania produktu:', error);
            return res.status(404).json({ status: 'error', message: 'Produkt nie znaleziony' });
        }

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/products/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas pobierania produktu', details: err.message });
    }
});

// Utwórz nowy produkt
app.post('/api/admin/products', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const body = req.body || {};

    // Prosta walidacja minimalna
    if (!body.identifier || !body.category || typeof body.price === 'undefined') {
        return res.status(400).json({
            status: 'error',
            message: 'Wymagane pola: identifier, category, price'
        });
    }

    const now = new Date().toISOString();

    const productData = {
        identifier: body.identifier,
        index: body.index || null,
        name: body.name || body.identifier,
        description: body.description || '',
        price: body.price || 0,
        code: body.code || null,
        availability: body.availability || 'AVAILABLE',
        productionPath: body.productionPath || null,
        dimensions: body.dimensions || null,
        imageUrl: body.imageUrl || null,
        category: body.category,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
        slug: body.slug || null,
        images: body.images || null,
        new: !!body.new,
        createdAt: now,
        updatedAt: now,
    };

    try {
        const { data, error } = await supabase
            .from('Product')
            .insert(productData)
            .select('*')
            .single();

        if (error) {
            console.error('Błąd tworzenia produktu:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć produktu', details: error.message });
        }

        return res.status(201).json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/products:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas tworzenia produktu', details: err.message });
    }
});

// Aktualizuj istniejący produkt
app.patch('/api/admin/products/:id', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const body = req.body || {};

    const updateData = { ...body, updatedAt: new Date().toISOString() };

    try {
        const { data, error } = await supabase
            .from('Product')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('Błąd aktualizacji produktu:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować produktu', details: error.message });
        }

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/products/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas aktualizacji produktu', details: err.message });
    }
});

// Usuń produkt
app.delete('/api/admin/products/:id', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('Product')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania produktu:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć produktu', details: error.message });
        }

        return res.json({ status: 'success', message: 'Produkt usunięty' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/products/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas usuwania produktu', details: err.message });
    }
});

// Aktualizacja stanów magazynowych produktu (Inventory, location='MAIN')
app.patch('/api/admin/products/:id/inventory', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const { stock = 0, stockOptimal = 0, stockOrdered = 0, stockReserved = 0 } = req.body || {};

    try {
        // Upewnij się, że produkt istnieje
        const { data: product, error: productError } = await supabase
            .from('Product')
            .select('id')
            .eq('id', id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ status: 'error', message: 'Produkt nie znaleziony' });
        }

        // Sprawdź, czy istnieje rekord Inventory dla location MAIN
        const { data: existingInv } = await supabase
            .from('Inventory')
            .select('id')
            .eq('productId', id)
            .eq('location', 'MAIN')
            .single();

        const inventoryData = {
            stock: Number(stock) || 0,
            stockOptimal: Number(stockOptimal) || 0,
            stockOrdered: Number(stockOrdered) || 0,
            stockReserved: Number(stockReserved) || 0,
            updatedAt: new Date().toISOString(),
        };

        if (existingInv) {
            const { error: updateErr } = await supabase
                .from('Inventory')
                .update(inventoryData)
                .eq('id', existingInv.id);

            if (updateErr) {
                console.error('Błąd aktualizacji Inventory:', updateErr);
                return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować stanów magazynowych', details: updateErr.message });
            }
        } else {
            const newInventory = {
                id: crypto.randomUUID(),
                productId: id,
                location: 'MAIN',
                reorderPoint: 0,
                ...inventoryData,
            };

            const { error: insertErr } = await supabase
                .from('Inventory')
                .insert(newInventory);

            if (insertErr) {
                console.error('Błąd tworzenia Inventory:', insertErr);
                return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć stanów magazynowych', details: insertErr.message });
            }
        }

        return res.json({ status: 'success', message: 'Stany magazynowe zapisane' });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/products/:id/inventory:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas zapisu stanów magazynowych', details: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);    
    console.log(`Środowisko: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Adres testowy: http://localhost:${PORT}/api/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Niezłapany błąd:', err);
});
