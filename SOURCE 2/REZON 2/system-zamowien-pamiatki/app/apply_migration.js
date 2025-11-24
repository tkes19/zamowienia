require('dotenv').config({ path: './.env' });
const { PrismaClient } = require('./node_modules/.prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    // Create UserFolderAccess table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "UserFolderAccess" (
          "id" SERIAL PRIMARY KEY,
          "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
          "folderName" VARCHAR(255) NOT NULL,
          "isActive" BOOLEAN DEFAULT true,
          "assignedBy" TEXT REFERENCES "User"("id"),
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create indices
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "UserFolderAccess_userId_isActive_idx" ON "UserFolderAccess"("userId", "isActive");
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "UserFolderAccess_folderName_idx" ON "UserFolderAccess"("folderName");
    `;

    // Create unique constraint
    await prisma.$executeRaw`
      ALTER TABLE "UserFolderAccess" ADD CONSTRAINT IF NOT EXISTS "UserFolderAccess_userId_folderName_key" UNIQUE ("userId", "folderName");
    `;

    console.log('✅ UserFolderAccess table created successfully');

    // Test if we can query users (just to check connection)
    const userCount = await prisma.user.count();
    console.log(`📊 Found ${userCount} users in database`);
  } catch (error) {
    console.error('❌ Error creating table:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
