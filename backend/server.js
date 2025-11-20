require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const { createPdf } = require('./pdfGenerator');

const app = express();
const PORT = process.env.PORT || 3001;

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
