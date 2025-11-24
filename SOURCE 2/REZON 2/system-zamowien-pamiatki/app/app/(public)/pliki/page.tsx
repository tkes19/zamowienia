'use client';

import React from 'react';
import { PublicLayout } from '@/components/public/PublicLayout';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, Image, Package, Palette } from 'lucide-react';

const pliki = [
  {
    id: 1,
    name: 'Katalog produktów REZON 2024',
    description: 'Pełny katalog wszystkich dostępnych produktów z cenami i specyfikacjami',
    type: 'PDF',
    size: '15.2 MB',
    icon: FileText,
    color: 'bg-red-500',
    downloadUrl: '#',
  },
  {
    id: 2,
    name: 'Szablony do personalizacji',
    description: 'Gotowe szablony graficzne dla najpopularniejszych produktów',
    type: 'ZIP',
    size: '8.7 MB',
    icon: Palette,
    color: 'bg-purple-500',
    downloadUrl: '#',
  },
  {
    id: 3,
    name: 'Instrukcje przygotowania grafik',
    description: 'Wytyczne techniczne do przygotowywania plików do druku',
    type: 'PDF',
    size: '2.1 MB',
    icon: FileText,
    color: 'bg-blue-500',
    downloadUrl: '#',
  },
  {
    id: 4,
    name: 'Logo i elementy brandingu',
    description: 'Oficjalne logo REZON w różnych formatach i kolorach',
    type: 'ZIP',
    size: '5.4 MB',
    icon: Image,
    color: 'bg-green-500',
    downloadUrl: '#',
  },
  {
    id: 5,
    name: 'Specyfikacje produktów',
    description: 'Szczegółowe wymiary i parametry techniczne wszystkich produktów',
    type: 'XLSX',
    size: '1.8 MB',
    icon: Package,
    color: 'bg-orange-500',
    downloadUrl: '#',
  },
  {
    id: 6,
    name: 'Cennik hurtowy 2024',
    description: 'Aktualny cennik z rabatami ilościowymi i warunkami współpracy',
    type: 'PDF',
    size: '900 KB',
    icon: FileText,
    color: 'bg-indigo-500',
    downloadUrl: '#',
  },
];

export default function PlikiPage() {
  const handleDownload = (fileName: string) => {
    // W rzeczywistości tutaj byłby właściwy link do pliku
    alert(`Pobieranie: ${fileName} (demo)`);
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

          <h1 className="text-3xl font-bold text-gray-800 mb-2">Pliki do pobrania</h1>
          <p className="text-gray-600">Katalogi, szablony i materiały pomocnicze</p>
        </div>

        {/* Content */}
        <div className="max-w-4xl">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">📋 Przydatne materiały</h3>
            <p className="text-blue-700 text-sm mb-3">
              Znajdziesz tutaj wszystkie niezbędne materiały do współpracy z REZON - od katalogów
              produktów, przez szablony graficzne, aż po instrukcje techniczne.
            </p>
            <ul className="text-blue-600 text-xs space-y-1">
              <li>• Wszystkie pliki są regularnie aktualizowane</li>
              <li>• Pobieranie jest bezpłatne i nie wymaga rejestracji</li>
              <li>• Masz pytania? Skontaktuj się z nami: hurtownia@rezon.eu</li>
            </ul>
          </div>

          {/* Files Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pliki.map(plik => {
              const IconComponent = plik.icon;
              return (
                <div
                  key={plik.id}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start">
                    <div className={`${plik.color} p-3 rounded-lg mr-4 flex-shrink-0`}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 mb-2">{plik.name}</h3>
                      <p className="text-sm text-gray-600 mb-3">{plik.description}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <span className="bg-gray-100 px-2 py-1 rounded">{plik.type}</span>
                          <span>{plik.size}</span>
                        </div>
                        <button
                          onClick={() => handleDownload(plik.name)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Pobierz
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                💡 Jak przygotować grafiki?
              </h3>
              <ul className="text-gray-600 text-sm space-y-2">
                <li>• Używaj wysokiej rozdzielczości (min. 300 DPI)</li>
                <li>• Zapisuj w formatach: PDF, AI, PSD, PNG</li>
                <li>• Zachowaj margines bezpieczeństwa 2mm</li>
                <li>• Używaj profilu kolorów CMYK do druku</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">📞 Potrzebujesz pomocy?</h3>
              <p className="text-gray-600 text-sm mb-3">
                Nasz zespół grafików chętnie pomoże w przygotowaniu projektów.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-600">
                  <span className="font-medium">Email:</span>
                  <span className="ml-2">grafika@rezon.eu</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-medium">Telefon:</span>
                  <span className="ml-2">+48 94 35 514 50</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Banner */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-6 mt-8">
            <h3 className="text-xl font-semibold mb-3">Chcesz zostać partnerem?</h3>
            <p className="mb-4 opacity-90">
              Oferujemy specjalne materiały marketingowe i wsparcie dla naszych partnerów
              biznesowych.
            </p>
            <Link
              href="/kontakt"
              className="bg-white text-orange-600 py-2 px-6 rounded-lg hover:bg-gray-100 transition-colors inline-block font-medium"
            >
              Skontaktuj się z nami
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
