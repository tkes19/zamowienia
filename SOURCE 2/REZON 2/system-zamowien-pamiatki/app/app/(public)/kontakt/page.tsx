'use client';

import React, { useState } from 'react';
import { PublicLayout } from '@/components/public/PublicLayout';
import Link from 'next/link';
import { ArrowLeft, Phone, Mail, MapPin, Clock, Send } from 'lucide-react';

export default function KontaktPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Tu byłaby logika wysyłania formularza
    alert('Formularz został wysłany! (demo)');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <PublicLayout>
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/katalog"
            className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Powrót do katalogu
          </Link>

          <h1 className="text-3xl font-bold text-gray-800 mb-2">Kontakt</h1>
          <p className="text-gray-600">
            Skontaktuj się z nami - chętnie odpowiemy na Twoje pytania
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Dane kontaktowe</h2>

              <div className="space-y-4">
                <div className="flex items-start">
                  <Phone className="h-5 w-5 text-blue-600 mr-3 mt-1" />
                  <div>
                    <p className="font-medium text-gray-800">Telefony</p>
                    <p className="text-gray-600">+48 94 35 514 50</p>
                    <p className="text-gray-600">+48 697 716 916</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Mail className="h-5 w-5 text-blue-600 mr-3 mt-1" />
                  <div>
                    <p className="font-medium text-gray-800">Email</p>
                    <p className="text-gray-600">hurtownia@rezon.eu</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Clock className="h-5 w-5 text-blue-600 mr-3 mt-1" />
                  <div>
                    <p className="font-medium text-gray-800">Godziny pracy</p>
                    <p className="text-gray-600">pon - pt: 7:00 - 15:00</p>
                    <p className="text-gray-600 text-sm">(od maja - do sierpnia):</p>
                    <p className="text-gray-600">pon - pt: 7:00 - 16:00</p>
                    <p className="text-gray-600">sb: 7:00 - 13:00</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Masz pytania?</h3>
              <p className="mb-4 opacity-90">
                Nasz zespół ekspertów jest gotowy pomóc Ci w wyborze idealnych produktów i
                personalizacji zgodnej z Twoimi potrzebami.
              </p>
              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-white bg-opacity-20 rounded flex items-center justify-center text-xs">
                  f
                </div>
                <div className="w-8 h-8 bg-white bg-opacity-20 rounded flex items-center justify-center text-xs">
                  ig
                </div>
                <div className="w-8 h-8 bg-white bg-opacity-20 rounded flex items-center justify-center text-xs">
                  in
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Napisz do nas</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Imię i nazwisko *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Jan Kowalski"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="jan@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+48 123 456 789"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Temat *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Zapytanie o produkty"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Wiadomość *
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Opisz swoje zapytanie..."
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <Send className="h-4 w-4 mr-2" />
                Wyślij wiadomość
              </button>
            </form>

            <p className="text-xs text-gray-500 mt-4">
              * Pola wymagane. Odpowiemy na Twoje zapytanie w ciągu 24 godzin.
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
