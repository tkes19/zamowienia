'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronDown, Phone, Mail } from 'lucide-react';

interface PublicSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function PublicSidebar({ isOpen = true, onClose }: PublicSidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed top-0 left-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 z-50 overflow-y-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      >
        <div className="p-6 min-h-full flex flex-col">
          {/* Logo */}
          <div className="flex items-center mb-8">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-bold">R</span>
            </div>
            <span className="text-xl font-bold text-gray-800">REZON</span>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            <Link
              href="/katalog"
              className="block py-2 px-3 text-gray-700 hover:bg-gray-100 rounded"
            >
              STRONA GŁÓWNA
            </Link>

            <div className="group">
              <div className="flex items-center justify-between py-2 px-3 text-gray-700 hover:bg-gray-100 rounded cursor-pointer">
                <span>PRODUKTY</span>
                <ChevronDown className="h-4 w-4" />
              </div>
              <div className="ml-4 space-y-1 text-sm">
                <Link
                  href="/katalog/magnesy"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  MAGNESY
                </Link>
                <Link
                  href="/katalog/breloki"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  BRELOKI
                </Link>
                <Link
                  href="/katalog/otwieracze"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  OTWIERACZE
                </Link>
                <Link
                  href="/katalog/ceramika"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  CERAMIKA I SZKŁO
                </Link>
                <Link
                  href="/katalog/dlugopisy"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  DŁUGOPISY
                </Link>
                <Link
                  href="/katalog/czapki"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  CZAPKI I NAKRYCIA GŁOWY
                </Link>
                <Link
                  href="/katalog/bransoletki"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  BRANSOLETKI
                </Link>
                <Link
                  href="/katalog/tekstylia"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  TEKSTYLIA
                </Link>
                <Link
                  href="/katalog/ozdoby"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  OZDOBY DOMOWE
                </Link>
                <Link
                  href="/katalog/akcesoria"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  AKCESORIA PODRÓŻNE
                </Link>
                <Link
                  href="/katalog/dzieci"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  DLA DZIECI
                </Link>
                <Link
                  href="/katalog/zapalniczki"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  ZAPALNICZKI I POPIELNICZKI
                </Link>
                <Link
                  href="/katalog/biznesowe"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  UPOMINKI BIZNESOWE
                </Link>
                <Link
                  href="/katalog/zestawy"
                  className="block py-1 px-3 text-gray-600 hover:text-blue-600"
                >
                  ZESTAWY
                </Link>
              </div>
            </div>

            <Link
              href="/nowosci"
              className="block py-2 px-3 text-gray-700 hover:bg-gray-100 rounded"
            >
              NOWOŚCI
            </Link>
            <Link href="/o-nas" className="block py-2 px-3 text-gray-700 hover:bg-gray-100 rounded">
              O NAS
            </Link>
            <Link
              href="/przedstawiciele"
              className="block py-2 px-3 text-gray-700 hover:bg-gray-100 rounded"
            >
              PRZEDSTAWICIELE HANDLOWI
            </Link>
            <Link
              href="/kontakt"
              className="block py-2 px-3 text-gray-700 hover:bg-gray-100 rounded"
            >
              KONTAKT
            </Link>
            <Link href="/pliki" className="block py-2 px-3 text-gray-700 hover:bg-gray-100 rounded">
              PLIKI DO POBRANIA
            </Link>
          </nav>

          {/* Contact Info - flex-grow to push login button to bottom */}
          <div className="mt-8 pt-8 border-t border-gray-200 flex-grow">
            <h3 className="font-semibold text-gray-800 mb-4">Zadzwoń do nas !</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>pon - pt: 7:00 - 15:00</p>
              <p>(od maja - do sierpnia):</p>
              <p>pon - pt: 7:00 - 16:00</p>
              <p>sb: 7:00 - 13:00</p>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center text-sm">
                <Phone className="h-4 w-4 mr-2" />
                <span>+48 94 35 514 50</span>
              </div>
              <div className="flex items-center text-sm">
                <Phone className="h-4 w-4 mr-2" />
                <span>+48 697 716 916</span>
              </div>
              <div className="flex items-center text-sm">
                <Mail className="h-4 w-4 mr-2" />
                <span>hurtownia@rezon.eu</span>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold text-gray-800 mb-2">Social Media</h4>
              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-xs">
                  f
                </div>
                <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center text-white text-xs">
                  X
                </div>
                <div className="w-8 h-8 bg-pink-500 rounded flex items-center justify-center text-white text-xs">
                  ig
                </div>
              </div>
            </div>
          </div>

          {/* Login Button - Always at bottom */}
          <div className="mt-8 pb-4">
            <Link
              href="/zamowienia"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-center block"
            >
              ZALOGUJ SIĘ
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
