'use client';

import React from 'react';
import { PublicLayout } from '@/components/public/PublicLayout';
import Link from 'next/link';
import { ArrowLeft, MapPin, Clock, Phone, Mail } from 'lucide-react';

export default function ONasPage() {
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

          <h1 className="text-3xl font-bold text-gray-800 mb-2">O nas</h1>
          <p className="text-gray-600">Poznaj historię i misję firmy REZON</p>
        </div>

        {/* Content */}
        <div className="max-w-4xl space-y-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Kim jesteśmy?</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              REZON to dynamicznie rozwijająca się firma specjalizująca się w produkcji i
              dystrybucji personalizowanych upominków oraz akcesoriów modowych. Od lat z pasją
              tworzymy unikalne produkty, które pozwalają naszym klientom wyrażać swoją
              indywidualność.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Nasza oferta obejmuje szeroką gamę produktów - od magnesów i breloków, przez ceramikę
              i tekstylia, aż po akcesoria podróżne i upominki biznesowe. Każdy produkt może być
              spersonalizowany zgodnie z potrzebami klienta.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Nasza misja</h3>
              <p className="text-gray-600 leading-relaxed">
                Dostarczamy wysokiej jakości, spersonalizowane produkty, które pomagają naszym
                klientom tworzyć niezapomniane wspomnienia i budować silne więzi z ich klientami i
                bliskimi.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Nasze wartości</h3>
              <ul className="text-gray-600 space-y-2">
                <li>• Jakość produktów i obsługi</li>
                <li>• Indywidualne podejście do klienta</li>
                <li>• Terminowość realizacji zamówień</li>
                <li>• Ciągły rozwój i innowacje</li>
              </ul>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Dane kontaktowe</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center">
                  <Phone className="h-5 w-5 mr-3" />
                  <span>+48 94 35 514 50</span>
                </div>
                <div className="flex items-center">
                  <Phone className="h-5 w-5 mr-3" />
                  <span>+48 697 716 916</span>
                </div>
                <div className="flex items-center">
                  <Mail className="h-5 w-5 mr-3" />
                  <span>hurtownia@rezon.eu</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start">
                  <Clock className="h-5 w-5 mr-3 mt-1" />
                  <div>
                    <p>pon - pt: 7:00 - 15:00</p>
                    <p className="text-sm opacity-90">(od maja - do sierpnia)</p>
                    <p>pon - pt: 7:00 - 16:00</p>
                    <p>sb: 7:00 - 13:00</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Dlaczego warto nas wybrać?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🏆</span>
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Doświadczenie</h4>
                <p className="text-gray-600 text-sm">Lata doświadczenia w branży personalizacji</p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">⚡</span>
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Szybkość</h4>
                <p className="text-gray-600 text-sm">Błyskawiczna realizacja zamówień</p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">💎</span>
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Jakość</h4>
                <p className="text-gray-600 text-sm">Najwyższej jakości materiały i wykonanie</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
