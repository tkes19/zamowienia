
-- Tabela UserFolderAccess dla KLIENCI INDYWIDUALNI
CREATE TABLE "UserFolderAccess" (
    "id" SERIAL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "folderName" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "assignedBy" TEXT REFERENCES "User"("id"),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Indeksy dla wydajności
CREATE INDEX "UserFolderAccess_userId_isActive_idx" ON "UserFolderAccess"("userId", "isActive");
CREATE INDEX "UserFolderAccess_folderName_idx" ON "UserFolderAccess"("folderName");

-- Przykładowe dane testowe (usuń po testach)
INSERT INTO "UserFolderAccess" ("userId", "folderName", "assignedBy", "notes") VALUES
  (
    (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1),
    'Estera Giemza',
    (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1),
    'Test folder dla handlowca'
  );

COMMENT ON TABLE "UserFolderAccess" IS 'Przypisania folderów handlowców do użytkowników systemu';
