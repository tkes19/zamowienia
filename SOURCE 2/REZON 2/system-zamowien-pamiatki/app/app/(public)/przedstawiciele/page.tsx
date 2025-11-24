'use client';

import React from 'react';
import { PublicLayout } from '@/components/public/PublicLayout';
import Link from 'next/link';
import { ArrowLeft, MapPin, Phone, Mail, User } from 'lucide-react';

const przedstawiciele = [
  {
    id: 1,
    name: 'Jan Kowalski',
    region: 'Województwo Zachodniopomorskie',
    phone: '+48 123 456 789',
    email: 'jan.kowalski@rezon.eu',
    cities: ['Szczecin', 'Koszalin', 'Stargard', 'Świnoujście'],
  },
  {
    id: 2,
    name: 'Anna Nowak',
    region: 'Województwo Pomorskie',
    phone: '+48 234 567 890',
    email: 'anna.nowak@rezon.eu',
    cities: ['Gdańsk', 'Gdynia', 'Sopot', 'Słupsk'],
  },
  {
    id: 3,
    name: 'Piotr Wiśniewski',
    region: 'Województwo Wielkopolskie',
    phone: '+48 345 678 901',
    email: 'piotr.wisniewski@rezon.eu',
    cities: ['Poznań', 'Kalisz', 'Konin', 'Piła'],
  },
];

export default function PrzedstawicielePage() {
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

          <h1 className="text-3xl font-bold text-gray-800 mb-2">Przedstawiciele Handlowi</h1>
          <p className="text-gray-600">Znajdź swojego lokalnego przedstawiciela REZON</p>
        </div>

        {/* Content */}
        <div className="max-w-4xl">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <div className="flex items-start">
              <div className="bg-blue-600 p-3 rounded-lg mr-4 flex-shrink-0">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-800 mb-2">
                  Dlaczego warto skontaktować się z przedstawicielem?
                </h3>
                <ul className="text-blue-700 space-y-1 text-sm">
                  <li>• Personalne doradztwo w wyborze produktów</li>
                  <li>• Pomoc w personalizacji i projektowaniu</li>
                  <li>• Lokalne wsparcie i szybsza realizacja</li>
                  <li>• Specjalne oferty dla stałych klientów</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Representatives Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {przedstawiciele.map(rep => (
              <div
                key={rep.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center mb-4">
                  <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center mr-4">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{rep.name}</h3>
                    <p className="text-sm text-gray-600">{rep.region}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 text-gray-400 mr-2" />
                    <a href={`tel:${rep.phone}`} className="text-blue-600 hover:text-blue-700">
                      {rep.phone}
                    </a>
                  </div>
                  <div className="flex items-center text-sm">
                    <Mail className="h-4 w-4 text-gray-400 mr-2" />
                    <a href={`mailto:${rep.email}`} className="text-blue-600 hover:text-blue-700">
                      {rep.email}
                    </a>
                  </div>
                </div>

                <div>
                  <div className="flex items-center mb-2">
                    <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Obsługiwane miasta:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rep.cities.map((city, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                      >
                        {city}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Contact Info */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-6 mt-8">
            <h3 className="text-xl font-semibold mb-4">Nie widzisz swojego regionu?</h3>
            <p className="mb-4 opacity-90">
              Skontaktuj się z naszym biurem głównym - pomożemy Ci znaleźć najbliższego
              przedstawiciela lub bezpośrednio obsłużymy Twoje zamówienie.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <Phone className="h-5 w-5 mr-3" />
                <div>
                  <p>+48 94 35 514 50</p>
                  <p>+48 697 716 916</p>
                </div>
              </div>
              <div className="flex items-center">
                <Mail className="h-5 w-5 mr-3" />
                <span>hurtownia@rezon.eu</span>
              </div>
            </div>
          </div>

          {/* Application Form */}
          <div className="bg-white rounded-lg shadow-md p-6 mt-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Chcesz zostać naszym przedstawicielem?
            </h3>
            <p className="text-gray-600 mb-4">
              Jeśli jesteś przedsiębiorczy i chciałbyś reprezentować markę REZON w swoim regionie,
              skontaktuj się z nami. Oferujemy atrakcyjne warunki współpracy.
            </p>
            <Link
              href="/kontakt"
              className="bg-orange-500 text-white py-2 px-6 rounded-lg hover:bg-orange-600 transition-colors inline-block"
            >
              Skontaktuj się z nami
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
