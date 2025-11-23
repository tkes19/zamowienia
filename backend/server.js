require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
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
