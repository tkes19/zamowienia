'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PublicLayout } from '@/components/public/PublicLayout';
import { categoryConfig } from '@/lib/categoryConfig';

// Strona główna = Katalog publiczny (bez logowania)
export default function HomePage() {
  return (
    <PublicLayout>
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mr-4">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-800">REZON</h1>
          </div>
          <p className="text-gray-600">Personalizowane upominki i akcesoria modowe</p>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categoryConfig.categories.map(category => (
            <Link key={category.id} href={`/katalog/${category.slug}`} className="group">
              <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                {/* Image Container */}
                <div className="relative h-48 bg-gray-100">
                  <Image
                    src={category.image}
                    alt={category.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="bg-blue-800 text-white text-sm font-semibold py-1 px-3 rounded mb-3 inline-block">
                    {category.name.toUpperCase()}
                  </div>
                  <p className="text-gray-600 text-sm">{category.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
