import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

// Ensure environment variables are loaded
import 'dotenv/config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    console.log('🔍 API /customers called');
    console.log('🔍 DATABASE_URL available:', !!process.env.DATABASE_URL);
    console.log('🔍 NODE_ENV:', process.env.NODE_ENV);

    const { searchParams } = new URL(request.url);
    const demoMode = searchParams.get('demo') === 'true';

    let session;
    if (!demoMode) {
      session = await getServerSession(authOptions);

      if (!session) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }
    }

    let customers;

    try {
      if (!demoMode && session?.user?.role === 'SALES_REP') {
        // Sales reps can only see their own customers
        customers = await prisma.customer.findMany({
          where: {
            salesRepId: session.user.id,
          },
          orderBy: {
            name: 'asc',
          },
        });
      } else if (
        !demoMode &&
        session?.user?.role &&
        ['ADMIN', 'SALES_DEPT', 'WAREHOUSE'].includes(session.user.role)
      ) {
        // Admins and other roles can see all customers
        customers = await prisma.customer.findMany({
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            name: 'asc',
          },
        });
      } else if (!demoMode) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      } else {
        // Force fallback for demo mode
        throw new Error('Demo mode - using fallback data');
      }
    } catch (dbError) {
      console.error('Database connection failed, using fallback customers:', dbError);

      // Fallback customers when database is unavailable
      console.error('🔴 DATABASE CONNECTION FAILED - Using fallback customers');
      console.error('Please check:');
      console.error('1. DATABASE_URL environment variable');
      console.error('2. Supabase project status');
      console.error('3. Network connectivity');

      customers = [
        {
          id: 'fallback-customer-1',
          name: 'Hotel Górski',
          address: 'ul. Turystyczna 15, 34-500 Zakopane',
          phone: '+48 18 206 1234',
          email: 'zamowienia@hotelgorski.pl',
          notes: '🔴 FALLBACK: Baza danych niedostępna - sprawdź connection string',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          salesRepId: demoMode ? 'demo-user' : session?.user?.id,
        },
        {
          id: 'fallback-customer-2',
          name: 'Sklep Pamiątek "Wisła"',
          address: 'ul. Górska 45, 43-460 Wisła',
          phone: '+48 33 855 1234',
          email: 'sklep@wisla-pamiatki.pl',
          notes: '🔴 FALLBACK: Baza danych niedostępna - sprawdź connection string',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          salesRepId: demoMode ? 'demo-user' : session?.user?.id,
        },
        {
          id: 'fallback-customer-3',
          name: 'Centrum Handlowe Marina',
          address: 'ul. Żeglarska 15, 80-560 Gdańsk',
          phone: '+48 58 301 5678',
          email: 'biuro@marina-gdansk.pl',
          notes: '🔴 FALLBACK: Baza danych niedostępna - sprawdź connection string',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          salesRepId: demoMode ? 'demo-user' : session?.user?.id,
        },
        {
          id: 'fallback-customer-4',
          name: 'Restauracja Stary Kraków',
          address: 'ul. Floriańska 12, 31-021 Kraków',
          phone: '+48 12 422 8765',
          email: 'zamowienia@stary-krakow.pl',
          notes: '🔴 FALLBACK: Baza danych niedostępna - sprawdź connection string',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          salesRepId: demoMode ? 'demo-user' : session?.user?.id,
        },
        {
          id: 'fallback-customer-5',
          name: 'Pensjonat Bałtyk',
          address: 'ul. Nadmorska 88, 76-150 Darłowo',
          phone: '+48 94 314 2345',
          email: 'recepcja@pensjonat-baltyk.pl',
          notes: '🔴 FALLBACK: Baza danych niedostępna - sprawdź connection string',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          salesRepId: demoMode ? 'demo-user' : session?.user?.id,
        },
      ];
    }

    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'SALES_REP') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { name, address, phone, email, notes } = await request.json();

    if (!name) {
      return NextResponse.json({ message: 'Customer name is required' }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        id: crypto.randomUUID(),
        name,
        address,
        phone,
        email,
        notes,
        salesRepId: session.user.id,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
