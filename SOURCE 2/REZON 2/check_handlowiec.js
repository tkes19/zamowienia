require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findUnique({
    where: { email: 'handlowiec@pamiatki.pl' },
    select: { name: true, email: true, role: true, companyName: true }
  });

  if (user) {
    console.log('✅ Użytkownik znaleziony:');
    console.log(` • Imię: ${user.name}`);
    console.log(` • Email: ${user.email}`);
    console.log(` • Rola: ${user.role}`);
    console.log(` • Firma: ${user.companyName}`);
  } else {
    console.log('❌ Użytkownik nie istnieje w bazie danych!');
  }

  await prisma.$disconnect();
}

run();
