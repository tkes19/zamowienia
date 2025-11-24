import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SALES_REP')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: 'Nieprawidłowy typ pliku. Dozwolone: JPG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { message: 'Plik jest zbyt duży. Maksymalny rozmiar: 5MB' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const extension = path.extname(file.name);
    const uniqueName = randomBytes(16).toString('hex') + extension;
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'products', uniqueName);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(uploadPath, buffer);

    // Return the public URL
    const imageUrl = `/uploads/products/${uniqueName}`;

    return NextResponse.json({
      message: 'Plik został przesłany pomyślnie',
      imageUrl,
      fileName: uniqueName,
      originalName: file.name,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ message: 'Błąd podczas przesyłania pliku' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SALES_REP')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // This could be extended to list uploaded files
    return NextResponse.json({
      message: 'Upload endpoint ready',
      supportedMethods: ['POST'],
      maxFileSize: '5MB',
      allowedTypes: ['JPG', 'PNG', 'WebP', 'GIF'],
    });
  } catch (error) {
    console.error('Error in upload GET:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
