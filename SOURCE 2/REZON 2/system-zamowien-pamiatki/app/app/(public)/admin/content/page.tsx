'use client';

import React, { useState } from 'react';
import { Save, Upload, Eye } from 'lucide-react';
import { categoryConfig } from '@/lib/categoryConfig';

export default function ContentEditorPage() {
  const [config, setConfig] = useState(categoryConfig);
  const [activeTab, setActiveTab] = useState('categories');

  const handleCategoryChange = (categoryId: string, field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId ? { ...cat, [field]: value } : cat
      ),
    }));
  };

  const handleSiteChange = (field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      site: { ...prev.site, [field]: value },
    }));
  };

  const handleSave = () => {
    // W rzeczywistości zapisałbyś to do pliku lub bazy danych
    console.log('Config to save:', config);
    alert('Konfiguracja zapisana! (w dev mode - sprawdź konsolę)');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">📝 Edytor Treści Katalogu</h1>
              <div className="flex space-x-3">
                <button
                  onClick={handleSave}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Zapisz
                </button>
                <a
                  href="/katalog"
                  target="_blank"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Podgląd
                </a>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('categories')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'categories'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Kategorie ({config.categories.length})
              </button>
              <button
                onClick={() => setActiveTab('site')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'site'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Ustawienia Strony
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'categories' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Edytuj Kategorie Produktów
                </h2>

                {config.categories.map(category => (
                  <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left Column - Form */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nazwa Kategorii
                          </label>
                          <input
                            type="text"
                            value={category.name}
                            onChange={e =>
                              handleCategoryChange(category.id, 'name', e.target.value)
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Opis
                          </label>
                          <textarea
                            value={category.description}
                            onChange={e =>
                              handleCategoryChange(category.id, 'description', e.target.value)
                            }
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            URL Obrazka
                          </label>
                          <div className="flex space-x-2">
                            <input
                              type="url"
                              value={category.image}
                              onChange={e =>
                                handleCategoryChange(category.id, 'image', e.target.value)
                              }
                              placeholder="https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Icons_example.png/250px-Icons_example.png"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200">
                              <Upload className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Użyj Unsplash.com dla darmowych zdjęć: ?w=400&h=300&fit=crop&crop=center
                          </p>
                        </div>
                      </div>

                      {/* Right Column - Preview */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Podgląd:</h4>
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                          <div className="relative h-32 bg-gray-200">
                            {category.image && (
                              <img
                                src={category.image}
                                alt={category.name}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="p-3">
                            <div className="bg-blue-800 text-white text-xs font-semibold py-1 px-2 rounded mb-2 inline-block">
                              {category.name.toUpperCase()}
                            </div>
                            <p className="text-gray-600 text-xs">{category.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'site' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Ustawienia Strony</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tytuł Strony
                    </label>
                    <input
                      type="text"
                      value={config.site.title}
                      onChange={e => handleSiteChange('title', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Opis</label>
                    <input
                      type="text"
                      value={config.site.description}
                      onChange={e => handleSiteChange('description', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telefon 1
                    </label>
                    <input
                      type="tel"
                      value={config.site.contactPhone1}
                      onChange={e => handleSiteChange('contactPhone1', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telefon 2
                    </label>
                    <input
                      type="tel"
                      value={config.site.contactPhone2}
                      onChange={e => handleSiteChange('contactPhone2', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Kontaktowy
                    </label>
                    <input
                      type="email"
                      value={config.site.contactEmail}
                      onChange={e => handleSiteChange('contactEmail', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">💡 Wskazówki:</h3>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Używaj Unsplash.com dla darmowych, wysokiej jakości zdjęć</li>
                    <li>
                      • Dodaj ?w=400&h=300&fit=crop&crop=center na końcu URL dla optymalnego
                      rozmiaru
                    </li>
                    <li>• Opisy powinny mieć 60-80 znaków dla najlepszego wyglądu</li>
                    <li>• Kliknij "Podgląd" żeby zobaczyć zmiany na żywo</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
