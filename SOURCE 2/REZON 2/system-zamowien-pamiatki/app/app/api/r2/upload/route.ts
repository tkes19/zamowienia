import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadFile, getR2PublicUrl } from '@/lib/r2';
import { randomBytes } from 'crypto';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    // Sprawdź autoryzację
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SALES_REP')) {
      return NextResponse.json({ success: false, message: 'Brak uprawnień' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Brak pliku' }, { status: 400 });
    }

    // Sprawdź typ pliku
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Nieprawidłowy typ pliku. Dozwolone: JPG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    // Sprawdź rozmiar pliku (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, message: 'Plik jest zbyt duży. Maksymalny rozmiar: 5MB' },
        { status: 400 }
      );
    }

    // Wygeneruj unikalny klucz pliku
    const extension = path.extname(file.name);
    const uniqueName = randomBytes(16).toString('hex') + extension;
    const key = `produkty/${uniqueName}`;

    // Konwertuj plik do Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload do R2
    const success = await uploadFile(key, buffer, file.type);

    if (success) {
      const imageUrl = getR2PublicUrl(key);

      return NextResponse.json({
        success: true,
        message: 'Plik został wysłany pomyślnie',
        imageUrl: imageUrl,
        key: key,
        fileName: uniqueName,
        originalName: file.name,
        size: buffer.length,
      });
    } else {
      return NextResponse.json(
        { success: false, message: 'Błąd podczas uploadu pliku' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Błąd uploadu: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
      },
      { status: 500 }
    );
  }
}
