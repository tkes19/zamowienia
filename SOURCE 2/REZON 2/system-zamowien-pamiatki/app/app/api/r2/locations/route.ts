import { NextResponse } from 'next/server';
import AWS from 'aws-sdk';

export const dynamic = 'force-dynamic';

// Konfiguracja Cloudflare R2
const s3 = new AWS.S3({
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  s3ForcePathStyle: true,
  region: 'auto',
});

const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

// Funkcja normalizacji nazwy (identyczna jak w KLIENCI INDYWIDUALNI)
const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/ /g, '_')
    .replace(/ą/g, 'ą')
    .replace(/ć/g, 'ć')
    .replace(/ę/g, 'ę')
    .replace(/ł/g, 'ł')
    .replace(/ń/g, 'ń')
    .replace(/ó/g, 'ó')
    .replace(/ś/g, 'ś')
    .replace(/ź/g, 'ź')
    .replace(/ż/g, 'ż');
};

// Funkcja wyciągnięcia identyfikatora z nazwy pliku (identyczna jak w KI)
const extractIdentifierFromFile = (fileName: string, locationName: string): string => {
  const normalizedLocation = normalizeName(locationName);
  const baseName = fileName.replace(/\.[^.]+$/i, '');
  const baseNameLower = baseName.toLowerCase();
  const expectedPrefix = `${normalizedLocation}_`;

  if (!baseNameLower.startsWith(expectedPrefix)) {
    console.warn(
      `Prefix "${expectedPrefix}" nie pasuje do "${baseName}" dla miejscowości "${locationName}"`
    );
    // Fallback: zwróć całą nazwę bez rozszerzenia
    return baseName;
  }

  return baseName.slice(expectedPrefix.length);
};

export async function GET() {
  try {
    // Szczegółowe sprawdzenie konfiguracji
    const config = {
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    };

    console.log('R2 Configuration check:', {
      endpoint: config.endpoint ? 'SET' : 'MISSING',
      accessKeyId: config.accessKeyId ? 'SET' : 'MISSING',
      secretAccessKey: config.secretAccessKey ? 'SET' : 'MISSING',
      bucketName: config.bucketName ? 'SET' : 'MISSING',
    });

    if (!config.bucketName || !config.accessKeyId || !config.secretAccessKey || !config.endpoint) {
      return NextResponse.json(
        {
          success: false,
          error: 'R2 configuration incomplete',
          missing: {
            endpoint: !config.endpoint,
            accessKeyId: !config.accessKeyId,
            secretAccessKey: !config.secretAccessKey,
            bucketName: !config.bucketName,
          },
        },
        { status: 500 }
      );
    }

    // Fallback dane dla przypadku gdy R2 nie jest dostępne
    const fallbackLocations = [
      {
        name: 'Gdańsk',
        productIdentifiers: ['brelok_graver_kolo', 'magnes_serce', 'kubek_bialy'],
      },
      {
        name: 'Kołobrzeg',
        productIdentifiers: [
          'brelok_graver_kolo',
          'magnes_serce',
          'kubek_bialy',
          'koszulka_niebieska',
        ],
      },
    ];

    // Pobierz foldery z PROJEKTY MIEJSCOWOŚCI/
    const params = {
      Bucket: config.bucketName,
      Prefix: 'PROJEKTY MIEJSCOWOŚCI/',
      Delimiter: '/',
    };

    const data = await s3.listObjectsV2(params).promise();

    const locations: Array<{ name: string; productIdentifiers: string[] }> = [];
    if (data.CommonPrefixes) {
      // Zbierz wszystkie promises dla równoległego wykonania
      const locationPromises = data.CommonPrefixes.filter(prefixObj => prefixObj.Prefix).map(
        async prefixObj => {
          const locationName = prefixObj
            .Prefix!.replace('PROJEKTY MIEJSCOWOŚCI/', '')
            .replace('/', '');

          if (!locationName) return null;

          try {
            // Pobierz pliki dla tej miejscowości
            const filesParams = {
              Bucket: config.bucketName!,
              Prefix: `PROJEKTY MIEJSCOWOŚCI/${locationName}/`,
              MaxKeys: 10000, // Zwiększony limit dla dużych folderów
            };

            console.log(`🔍 Skanowanie folderu: PROJEKTY MIEJSCOWOŚCI/${locationName}/`);
            const filesData = await s3.listObjectsV2(filesParams).promise();

            const productIdentifiers: string[] = [];
            const allFiles: string[] = [];
            const jpgFiles: string[] = [];

            const contents = filesData.Contents ?? [];
            for (const obj of contents) {
              const key = obj.Key;
              if (!key) continue;

              const fileName = key.split('/').pop();
              if (!fileName) continue;

              allFiles.push(fileName);

              if (!/\.jpe?g$/i.test(fileName)) continue;

              jpgFiles.push(fileName);

              // Wyciągnij identyfikator produktu z nazwy pliku (identyczna logika jak w KI)
              const identifier = extractIdentifierFromFile(fileName, locationName);

              if (!identifier || identifier.length === 0) continue;

              // Sprawdź czy identyfikator został poprawnie wyciągnięty
              const originalNameLower = fileName.replace(/\.[^.]+$/i, '').toLowerCase();
              if (identifier.toLowerCase() === originalNameLower) continue;

              productIdentifiers.push(identifier);
            }

            console.log(
              `📊 ${locationName}: ${allFiles.length} wszystkich plików, ${jpgFiles.length} plików JPG, ${productIdentifiers.length} produktów`
            );
            if (locationName === 'Gdańsk' && allFiles.length > 10) {
              console.log(`🔍 Gdańsk - pierwsze 10 plików:`, allFiles.slice(0, 10));
              console.log(`🔍 Gdańsk - pierwsze 10 produktów:`, productIdentifiers.slice(0, 10));
            }

            return {
              name: locationName,
              productIdentifiers: productIdentifiers.sort(),
            };
          } catch (error) {
            console.error(`Błąd pobierania plików dla ${locationName}:`, error);
            // Zwróć pustą lokalizację zamiast przerywać cały proces
            return {
              name: locationName,
              productIdentifiers: [],
            };
          }
        }
      );

      // Wykonaj wszystkie zapytania równolegle
      console.log(`🚀 Pobieranie danych dla ${locationPromises.length} miejscowości równolegle...`);
      const locationResults = await Promise.allSettled(locationPromises);

      // Zbierz udane wyniki
      locationResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          locations.push(result.value);
        } else {
          console.error(
            `Błąd dla lokalizacji ${index}:`,
            result.status === 'rejected' ? result.reason : 'Brak danych'
          );
        }
      });

      console.log(
        `✅ Załadowano ${locations.length} miejscowości z ${locationResults.length} zapytań`
      );
    }

    // Jeśli nie ma danych z R2, użyj fallback
    const finalLocations = locations.length > 0 ? locations : fallbackLocations;

    return NextResponse.json({
      success: true,
      locations: finalLocations.sort((a, b) => a.name.localeCompare(b.name)),
      source: locations.length > 0 ? 'r2' : 'fallback',
    });
  } catch (error) {
    console.error('Error fetching locations from R2:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // W przypadku błędu, zwróć fallback dane
    const fallbackLocations = [
      {
        name: 'Gdańsk',
        productIdentifiers: ['brelok_graver_kolo', 'magnes_serce', 'kubek_bialy'],
      },
      {
        name: 'Kołobrzeg',
        productIdentifiers: [
          'brelok_graver_kolo',
          'magnes_serce',
          'kubek_bialy',
          'koszulka_niebieska',
        ],
      },
    ];

    return NextResponse.json({
      success: true,
      locations: fallbackLocations,
      source: 'fallback',
      error: 'R2 connection failed, using fallback data',
      details: errorMessage,
    });
  }
}
