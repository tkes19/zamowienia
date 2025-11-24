'use client';

import { useMemo, useState } from 'react';
import { useAdvancedOCR } from '@/hooks/use-advanced-ocr';
import { OCRResult } from '@/lib/ocr-utils';

export function TestOCR() {
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [customUrl, setCustomUrl] = useState<string>('');

  const { processImage, isProcessing, progress } = useAdvancedOCR();

  const [showProcessedPreview, setShowProcessedPreview] = useState<boolean>(false);
  const [blockSize, setBlockSize] = useState<number>(25);
  const [offsetC, setOffsetC] = useState<number>(7);

  const normalizedBlock = useMemo(() => (blockSize % 2 === 0 ? blockSize + 1 : blockSize), [blockSize]);
  const normalizedOffset = useMemo(() => Math.max(0, offsetC), [offsetC]);

  // Przykładowe obrazy do testowania
  const sampleImages = [
    {
      name: 'Kołobrzeg - metalowe kapsle',
      url: '/kolobrzeg-kapsle.png',
      description: 'Prawdziwy obraz z numerami projektów 1-9 na metalowych kapslach',
    },
    {
      name: 'NIEZBĘDNIK Gdańsk',
      url: '/api/test-image',
      description: 'Przykładowy obraz z numerami projektów',
    },
    {
      name: 'Test Wikipedia OCR',
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/OCR-A_sample.svg/1200px-OCR-A_sample.svg.png',
      description: 'Klasyczny obraz testowy OCR',
    },
  ];

  const getCurrentImageUrl = () => {
    if (uploadedFile) {
      return URL.createObjectURL(uploadedFile);
    }
    if (customUrl) {
      return customUrl;
    }
    return selectedImageUrl || sampleImages[0].url;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedFile(file);
      setSelectedImageUrl('');
      setCustomUrl('');
    }
  };

  const handleImageSelect = (url: string) => {
    setSelectedImageUrl(url);
    setUploadedFile(null);
    setCustomUrl('');
  };

  const handleCustomUrl = (url: string) => {
    setCustomUrl(url);
    setUploadedFile(null);
    setSelectedImageUrl('');
  };

  const runFastOCR = async () => {
    const imageUrl = getCurrentImageUrl();
    if (!imageUrl) {
      alert('Wybierz obraz do testowania!');
      return;
    }

    console.log('🔍 Rozpoczynam szybki OCR z obrazem:', imageUrl);
    setOcrResult(null);

    try {
      const result = await processImage(imageUrl, {
        useColorSegmentation: true,
        preprocessImage: true,
        tesseractPSM: '11',
        characterWhitelist: '0123456789',
        preprocessOptions: {
          blockSize: normalizedBlock,
          offsetC: normalizedOffset,
          alternateBlockSize: normalizedBlock + 6,
          alternateOffsetC: Math.max(1, normalizedOffset - 2),
          capturePreview: showProcessedPreview,
        },
      });

      setOcrResult(result);
      console.log('✅ Szybki OCR zakończony:', result);
    } catch (error: any) {
      console.error('❌ Błąd OCR:', error);
      alert(`Błąd OCR: ${error.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">⚡ Test szybkiego OCR - NIEZBĘDNIK Gdańsk</h1>

        {/* Wybór obrazu */}
        <div className="mb-6 space-y-4">
          <h3 className="text-lg font-semibold">Wybierz obraz do testowania:</h3>

          {/* Przykładowe obrazy */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Przykładowe obrazy:</h4>
            <div className="grid grid-cols-1 gap-2">
              {sampleImages.map((image, index) => (
                <button
                  key={index}
                  onClick={() => handleImageSelect(image.url)}
                  className={`p-3 text-left border rounded-lg transition-colors ${
                    selectedImageUrl === image.url
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{image.name}</div>
                  <div className="text-sm text-gray-600">{image.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Wgraj własny obraz */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Lub wgraj własny obraz:</h4>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploadedFile && (
              <div className="text-sm text-green-600">✅ Wybrano: {uploadedFile.name}</div>
            )}
          </div>

          {/* Własny URL */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Lub wprowadź URL obrazu:</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => handleCustomUrl(customUrl)}
                disabled={!customUrl}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300"
              >
                Użyj
              </button>
            </div>
          </div>
        </div>

        {/* Podgląd wybranego obrazu */}
        {getCurrentImageUrl() && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Obraz do analizy:</h3>
            <img
              src={getCurrentImageUrl()}
              alt="Test image"
              className="max-w-md border rounded-lg"
              onError={e => {
                console.error('Błąd ładowania obrazu:', e);
                (e.target as HTMLImageElement).src =
                  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5CcmFrIG9icmF6dTwvdGV4dD48L3N2Zz4=';
              }}
            />
            <p className="text-sm text-gray-600 mt-2">
              Źródło: {uploadedFile ? `Plik: ${uploadedFile.name}` : getCurrentImageUrl()}
            </p>
          </div>
        )}

        {/* Opcje preprocessingu i uruchomienie */}
        <div className="mb-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <h3 className="text-lg font-semibold">Ustawienia preprocessingu:</h3>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showProcessedPreview}
                onChange={event => setShowProcessedPreview(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Pokaż podgląd obrazu po preprocessingu
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Rozmiar okna (blockSize): {normalizedBlock}
                </label>
                <input
                  type="range"
                  min={15}
                  max={51}
                  step={2}
                  value={normalizedBlock}
                  onChange={event => setBlockSize(parseInt(event.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Offset C (czułość progu): {normalizedOffset}
                </label>
                <input
                  type="range"
                  min={2}
                  max={15}
                  step={1}
                  value={normalizedOffset}
                  onChange={event => setOffsetC(parseInt(event.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Przycisk testowy */}
          <div className="space-y-2">
            <button
              onClick={runFastOCR}
              disabled={isProcessing}
              className={`w-full px-6 py-4 rounded-lg font-semibold text-lg ${
                isProcessing
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isProcessing ? '⚡ Przetwarzanie OCR...' : '⚡ Uruchom szybki OCR'}
            </button>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Szybkie rozpoznawanie numerów projektów (tryb standardowy)
            </p>
          </div>
        </div>

        {/* Progress */}
        {isProcessing && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-blue-700">{progress}</span>
            </div>
          </div>
        )}

        {/* Wyniki szybkiego OCR */}
        {ocrResult && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">📋 Wyniki szybkiego OCR:</h3>

            <div className="bg-gray-50 p-6 rounded-lg space-y-4">
              {showProcessedPreview && ocrResult.processedPreviewDataUrl && (
                <div className="bg-white p-4 rounded border">
                  <h5 className="font-semibold mb-2">Podgląd po preprocessingu:</h5>
                  <img
                    src={ocrResult.processedPreviewDataUrl}
                    alt="Processed preview"
                    className="max-w-full border rounded"
                  />
                </div>
              )}
              {/* Główny wynik */}
              <div className="bg-white p-4 rounded border-l-4 border-green-500">
                <h4 className="font-semibold text-green-800 mb-2">🎯 Wykryte numery projektów:</h4>
                <div className="text-lg font-mono">
                  {ocrResult.projectNumbers.join(', ') || 'Brak'}
                </div>
              </div>

              {/* Szczegóły analizy */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded">
                  <div className="text-sm text-gray-600">Confidence:</div>
                  <div className="text-xl font-bold text-blue-600">
                    {Math.round(ocrResult.confidence)}%
                  </div>
                </div>

                <div className="bg-white p-3 rounded">
                  <div className="text-sm text-gray-600">Czas przetwarzania:</div>
                  <div className="text-xl font-bold text-purple-600">
                    {ocrResult.processingTime}ms
                  </div>
                </div>

                <div className="bg-white p-3 rounded">
                  <div className="text-sm text-gray-600">Szare obszary:</div>
                  <div className="text-xl font-bold text-gray-600">{ocrResult.grayAreasFound}</div>
                </div>
              </div>

              {/* Szczegóły procesowania */}
              {(ocrResult.originalNumbers.length > 0 || ocrResult.outliers.length > 0) && (
                <div className="bg-white p-4 rounded border">
                  <h5 className="font-semibold mb-2">🔍 Szczegóły analizy:</h5>
                  <div className="space-y-2 text-sm">
                    {ocrResult.originalNumbers.length > 0 && (
                      <div>
                        <span className="text-gray-600">Wykryte oryginalne numery:</span>
                        <span className="ml-2 font-mono">
                          {ocrResult.originalNumbers.join(', ')}
                        </span>
                      </div>
                    )}

                    {ocrResult.outliers.length > 0 && (
                      <div>
                        <span className="text-gray-600">Usunięte outliers:</span>
                        <span className="ml-2 font-mono text-red-600">
                          {ocrResult.outliers.join(', ')}
                        </span>
                      </div>
                    )}

                    {ocrResult.projectNumbers.length > ocrResult.originalNumbers.length && (
                      <div className="text-blue-600">
                        ✨ Zastosowano interpolację - wygenerowano pełną sekwencję 1-
                        {Math.max(...ocrResult.projectNumbers)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Instrukcje */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">⚡ Szybki OCR - tryb standardowy:</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>
            • <strong>Tryb standardowy:</strong> Najszybszy i najczęściej najlepszy
          </li>
          <li>
            • <strong>PSM 11 + 6:</strong> Najpierw sparse text, potem blok dla dogrywki
          </li>
          <li>
            • <strong>Whitelist:</strong> Tylko cyfry 0-9 dla lepszej dokładności
          </li>
          <li>
            • <strong>Filtracja outliers:</strong> Automatyczne usuwanie niepoprawnych wyników
          </li>
          <li>
            • <strong>Interpolacja:</strong> Generowanie pełnej sekwencji numerów projektów
          </li>
          <li>
            • <strong>Szybkość:</strong> Jeden tryb = krótki czas przetwarzania
          </li>
        </ul>
      </div>
    </div>
  );
}
