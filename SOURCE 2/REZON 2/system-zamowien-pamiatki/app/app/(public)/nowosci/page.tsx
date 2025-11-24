'use client';

import React, { useState, useEffect } from 'react';
import { PublicLayout } from '@/components/public/PublicLayout';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

interface Product {
  id: string;
  identifier: string;
  index: string;
  description: string;
  price: number;
  imageUrl?: string;
  category: string;
  isActive: boolean;
  new: boolean;
}

export default function NowosciPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNewProducts();
  }, []);

  const fetchNewProducts = async () => {
    try {
      const response = await fetch(`/api/products?demo=true`);
      if (response.ok) {
        const data = await response.json();
        // Filtruj tylko nowości
        const newProducts = data.filter((product: Product) => product.new && product.isActive);
        setProducts(newProducts);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
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

          <div className="flex items-center mb-4">
            <div className="bg-red-500 p-3 rounded-lg mr-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Nowości</h1>
              <p className="text-gray-600">Najnowsze produkty w naszej ofercie</p>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Ładowanie nowości...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.length > 0 ? (
              products.map(product => (
                <div
                  key={product.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="relative h-48 bg-gray-100">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.identifier}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <span className="text-4xl">📦</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                      NOWOŚĆ
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">{product.identifier}</h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-blue-600">
                        {product.price.toFixed(2)} zł
                      </span>
                      <span className="text-xs text-gray-500">Kod: {product.index}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <div className="text-6xl mb-4">✨</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Brak nowości</h3>
                <p className="text-gray-600">Obecnie nie mamy nowych produktów do pokazania.</p>
                <Link
                  href="/katalog"
                  className="inline-block mt-4 text-blue-600 hover:text-blue-700"
                >
                  Zobacz wszystkie produkty
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
