-- Migracja: Dane dla UserRoleAssignment (Faza 2)
-- Data: 2025-12-07
-- Autor: Cascade
-- Opis: Uruchamiać PO zatwierdzeniu zmian w enum UserRole (migracja 20251207_add_production_log_and_user_roles.sql)

INSERT INTO public."UserRoleAssignment" ("userId", role, "assignedAt")
SELECT u.id,
       u.role::public."UserRole",
       COALESCE(u."createdAt", NOW())
FROM public."User" u
WHERE u.role::text IN ('ADMIN','SALES_REP','WAREHOUSE','SALES_DEPT','PRODUCTION','GRAPHICS','NEW_USER','CLIENT', 'GRAPHIC_DESIGNER', 'PRODUCTION_MANAGER', 'OPERATOR')
ON CONFLICT ("userId", role) DO NOTHING;
