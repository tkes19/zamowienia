-- Schemat bazy Supabase dla systemu zamówień

-- Typy ENUM (ENUMERATED TYPES)
CREATE TYPE public."StartPageType" AS ENUM ('CATALOG', 'ORDERS');
CREATE TYPE public."ProductCategory" AS ENUM ('MAGNESY', 'BRELOKI', 'OTWIERACZE', 'CERAMIKA_I_SZKLO', 'DLUGOPISY', 'CZAPKI_I_NAKRYCIA_GLOWY', 'BRANSOLETKI', 'TEKSTYLIA', 'OZDOBY_DOMOWE', 'AKCESORIA_PODROZNE', 'DLA_DZIECI', 'ZAPALNICZKI_I_POPIELNICZKI', 'UPOMINKI_BIZNESOWE', 'ZESTAWY');
CREATE TYPE public."ProductSource" AS ENUM ('MIEJSCOWOSCI', 'KLIENCI_INDYWIDUALNI', 'IMIENNE', 'HASLA', 'OKOLICZNOSCIOWE');
CREATE TYPE public."OrderStatus" AS ENUM ('DRAFT', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE public."UserRole" AS ENUM ('ADMIN', 'SALES_REP', 'WAREHOUSE', 'SALES_DEPT', 'PRODUCTION', 'GRAPHICS', 'NEW_USER');

-- Wklejaj tutaj definicje tabel (CREATE TABLE ...) skopiowane z panelu Supabase.
-- Przykład struktury:
--   -- Tabela produktów
--   CREATE TABLE public."Product" (
--     ...
--   );
--
--   -- Tabela zamówień
--   CREATE TABLE public."Order" (
--     ...
--   );
--
-- Każdą kolejną tabelę dopisuj poniżej, oddzielając je pustą linią.


create table public."Account" (
  id text not null default (gen_random_uuid ())::text,
  "userId" text not null,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text null,
  access_token text null,
  expires_at integer null,
  token_type text null,
  scope text null,
  id_token text null,
  session_state text null,
  constraint Account_pkey primary key (id),
  constraint Account_provider_providerAccountId_key unique (provider, "providerAccountId"),
  constraint Account_userId_fkey foreign KEY ("userId") references "User" (id) on delete CASCADE
) TABLESPACE pg_default;


create table public."Customer" (
  id text not null default (gen_random_uuid ())::text,
  name text not null,
  email text null,
  phone text null,
  address text null,
  city text null,
  "zipCode" text null,
  country text null default 'Poland'::text,
  notes text null,
  "createdAt" timestamp with time zone null default now(),
  "updatedAt" timestamp with time zone null default now(),
  "salesRepId" text null,
  constraint Customer_pkey primary key (id),
  constraint Customer_salesRepId_fkey foreign KEY ("salesRepId") references "User" (id) on delete set null
) TABLESPACE pg_default;

create table public."Department" (
  id text not null,
  name text not null,
  "createdAt" timestamp without time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone not null,
  constraint Department_pkey primary key (id),
  constraint Department_name_key unique (name)
) TABLESPACE pg_default;

create table public."Inventory" (
  id text not null,
  "productId" text not null,
  stock integer null default 0,
  "stockReserved" integer null default 0,
  "stockOptimal" integer null default 0,
  "stockOrdered" integer null default 0,
  "reorderPoint" integer null default 0,
  location text null,
  "updatedAt" timestamp with time zone null default now(),
  "createdAt" timestamp with time zone null default now(),
  constraint Inventory_pkey primary key (id),
  constraint Inventory_productId_location_key unique ("productId", location),
  constraint Inventory_productId_fkey foreign KEY ("productId") references "Product" (id) on delete CASCADE
) TABLESPACE pg_default;

create table public."Order" (
  id text not null default (gen_random_uuid ())::text,
  "customerId" text null,
  status text not null default 'PENDING'::text,
  total numeric(10, 2) not null,
  notes text null,
  "createdAt" timestamp with time zone null default now(),
  "updatedAt" timestamp with time zone null default now(),
  "orderNumber" text not null default ''::text,
  "userId" text not null,
  constraint Order_pkey primary key (id),
  constraint Order_orderNumber_key unique ("orderNumber"),
  constraint Order_customerId_fkey foreign KEY ("customerId") references "Customer" (id) on delete set null,
  constraint Order_userId_fkey foreign KEY ("userId") references "User" (id) on update CASCADE on delete RESTRICT
) TABLESPACE pg_default;

create index IF not exists "idx_order_orderNumber" on public."Order" using btree ("orderNumber") TABLESPACE pg_default;

create table public."OrderItem" (
  id text not null default (gen_random_uuid ())::text,
  "orderId" text not null,
  "productId" text not null,
  quantity integer not null,
  "unitPrice" numeric(10, 2) not null,
  customization text null,
  "locationName" text null,
  "projectName" text null,
  source public.ProductSource not null default 'MIEJSCOWOSCI'::"ProductSource",
  "selectedProjects" text null,
  "projectQuantities" text null,
  "totalQuantity" integer null,
  "productionNotes" text null,
  constraint OrderItem_pkey primary key (id),
  constraint OrderItem_orderId_fkey foreign KEY ("orderId") references "Order" (id) on delete CASCADE,
  constraint OrderItem_productId_fkey foreign KEY ("productId") references "Product" (id) on delete CASCADE
) TABLESPACE pg_default;

create table public."Permission" (
  id text not null,
  code text not null,
  name text not null,
  description text null,
  category text not null,
  "createdAt" timestamp without time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone not null default CURRENT_TIMESTAMP,
  constraint Permission_pkey primary key (id),
  constraint Permission_code_key unique (code)
) TABLESPACE pg_default;

create index IF not exists "Permission_category_idx" on public."Permission" using btree (category) TABLESPACE pg_default;

create table public."PermissionAudit" (
  id text not null,
  role text not null,
  "permissionId" text not null,
  action text not null,
  "changedBy" text not null,
  "changedAt" timestamp without time zone not null default CURRENT_TIMESTAMP,
  reason text null,
  constraint PermissionAudit_pkey primary key (id)
) TABLESPACE pg_default;

create table public."Product" (
  id text not null default (gen_random_uuid ())::text,
  name text null,
  description text null,
  price numeric(10, 2) not null,
  code text null,
  availability text not null default 'AVAILABLE'::text,
  "productionPath" text null,
  dimensions text null,
  "imageUrl" text null,
  "createdAt" timestamp with time zone null default now(),
  "updatedAt" timestamp with time zone null default now(),
  identifier text null,
  index text null,
  "isActive" boolean null default true,
  category public.ProductCategory not null,
  slug text null,
  images jsonb null,
  new boolean null default false,
  constraint Product_pkey primary key (id),
  constraint Product_code_key unique (code),
  constraint Product_identifier_key unique (identifier)
) TABLESPACE pg_default;

create table public."RolePermission" (
  id text not null,
  role text not null,
  "permissionId" text not null,
  "grantedBy" text not null,
  "grantedAt" timestamp without time zone not null default CURRENT_TIMESTAMP,
  constraint RolePermission_pkey primary key (id),
  constraint RolePermission_permissionId_fkey foreign KEY ("permissionId") references "Permission" (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists "RolePermission_role_permissionId_key" on public."RolePermission" using btree (role, "permissionId") TABLESPACE pg_default;

create table public."Session" (
  id text not null default (gen_random_uuid ())::text,
  "sessionToken" text not null,
  "userId" text not null,
  expires timestamp with time zone not null,
  constraint Session_pkey primary key (id),
  constraint Session_sessionToken_key unique ("sessionToken"),
  constraint Session_userId_fkey foreign KEY ("userId") references "User" (id) on delete CASCADE
) TABLESPACE pg_default;


create table public."User" (
  id text not null default (gen_random_uuid ())::text,
  name text null,
  email text null,
  "emailVerified" timestamp with time zone null,
  image text null,
  password text null,
  role text not null default 'USER'::text,
  "companyName" text null,
  "createdAt" timestamp with time zone null default now(),
  "updatedAt" timestamp with time zone null default now(),
  "departmentId" text null,
  "isActive" boolean not null default true,
  "defaultStartPage" public.StartPageType null default 'CATALOG'::"StartPageType",
  constraint User_pkey primary key (id),
  constraint User_email_key unique (email),
  constraint User_departmentId_fkey foreign KEY ("departmentId") references "Department" (id) on delete set null
) TABLESPACE pg_default;

create table public."UserFolderAccess" (
  id serial not null,
  "userId" text not null,
  "folderName" character varying(255) not null,
  "isActive" boolean not null default true,
  "assignedBy" text null,
  notes text null,
  "createdAt" timestamp without time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone not null default CURRENT_TIMESTAMP,
  constraint UserFolderAccess_pkey primary key (id),
  constraint UserFolderAccess_userId_folderName_key unique ("userId", "folderName"),
  constraint UserFolderAccess_assignedBy_fkey foreign KEY ("assignedBy") references "User" (id) on update CASCADE on delete set null,
  constraint UserFolderAccess_userId_fkey foreign KEY ("userId") references "User" (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "UserFolderAccess_userId_isActive_idx" on public."UserFolderAccess" using btree ("userId", "isActive") TABLESPACE pg_default;

create index IF not exists "UserFolderAccess_folderName_idx" on public."UserFolderAccess" using btree ("folderName") TABLESPACE pg_default;


create table public."VerificationToken" (
  identifier text not null,
  token text not null,
  expires timestamp with time zone not null,
  constraint VerificationToken_identifier_token_key unique (identifier, token)
) TABLESPACE pg_default;

create table public.order_draft_items (
  id text not null default (gen_random_uuid ())::text,
  draft_id text not null,
  product_id text not null,
  quantity integer not null,
  unit_price numeric(10, 2) not null,
  total_price numeric(10, 2) not null,
  customization text null,
  projects text[] null,
  projects_details jsonb null,
  source character varying(10) not null,
  sort_order integer null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint order_draft_items_pkey primary key (id),
  constraint fk_order_draft_items_product foreign KEY (product_id) references "Product" (id) on delete RESTRICT,
  constraint fk_order_draft_items_draft foreign KEY (draft_id) references order_drafts (id) on delete CASCADE,
  constraint order_draft_items_unit_price_check check ((unit_price >= (0)::numeric)),
  constraint order_draft_items_quantity_check check ((quantity > 0)),
  constraint order_draft_items_source_check check (
    (
      (source)::text = any (
        (
          array[
            'PM'::character varying,
            'KI'::character varying,
            'IM'::character varying,
            'HA'::character varying,
            'OK'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint order_draft_items_total_price_check check ((total_price >= (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists idx_order_draft_items_draft_id on public.order_draft_items using btree (draft_id) TABLESPACE pg_default;

create index IF not exists idx_order_draft_items_product_id on public.order_draft_items using btree (product_id) TABLESPACE pg_default;

create index IF not exists idx_order_draft_items_source on public.order_draft_items using btree (source) TABLESPACE pg_default;

create index IF not exists idx_order_draft_items_sort_order on public.order_draft_items using btree (draft_id, sort_order) TABLESPACE pg_default;

create index IF not exists order_draft_items_draft_id_idx on public.order_draft_items using btree (draft_id) TABLESPACE pg_default;

create index IF not exists order_draft_items_product_id_idx on public.order_draft_items using btree (product_id) TABLESPACE pg_default;

create index IF not exists order_draft_items_sort_order_idx on public.order_draft_items using btree (draft_id, sort_order) TABLESPACE pg_default;

create trigger trigger_update_draft_total_value
after INSERT
or DELETE
or
update on order_draft_items for EACH row
execute FUNCTION update_draft_total_value ();

create trigger update_order_draft_items_updated_at BEFORE
update on order_draft_items for EACH row
execute FUNCTION update_updated_at_column ();


create table public.order_drafts (
  id text not null default (gen_random_uuid ())::text,
  user_id text not null,
  client_type character varying(10) not null,
  client_id text null,
  location_name character varying(255) null,
  custom_client_data jsonb null,
  total_value numeric(10, 2) null default 0,
  status character varying(20) null default 'draft'::character varying,
  session_id character varying(255) null,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint order_drafts_pkey primary key (id),
  constraint fk_order_drafts_user foreign KEY (user_id) references "User" (id) on delete CASCADE,
  constraint order_drafts_client_type_check check (
    (
      (client_type)::text = any (
        (
          array[
            'PM'::character varying,
            'KI'::character varying,
            'IM'::character varying,
            'HA'::character varying,
            'OK'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint order_drafts_status_check check (
    (
      (status)::text = any (
        (
          array[
            'draft'::character varying,
            'active'::character varying,
            'completed'::character varying,
            'cancelled'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint order_drafts_total_value_check check ((total_value >= (0)::numeric)),
  constraint check_one_active_draft_per_user EXCLUDE using gist (
    user_id
    with
      =
  )
  where
    (((status)::text = 'active'::text))
) TABLESPACE pg_default;

create index IF not exists idx_order_drafts_user_id on public.order_drafts using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_order_drafts_status on public.order_drafts using btree (status) TABLESPACE pg_default;

create index IF not exists idx_order_drafts_user_status on public.order_drafts using btree (user_id, status) TABLESPACE pg_default;

create index IF not exists idx_order_drafts_session_id on public.order_drafts using btree (session_id) TABLESPACE pg_default
where
  (session_id is not null);

create index IF not exists idx_order_drafts_updated_at on public.order_drafts using btree (updated_at) TABLESPACE pg_default;

create index IF not exists order_drafts_user_id_idx on public.order_drafts using btree (user_id) TABLESPACE pg_default;

create index IF not exists order_drafts_status_idx on public.order_drafts using btree (status) TABLESPACE pg_default;

create index IF not exists order_drafts_user_status_idx on public.order_drafts using btree (user_id, status) TABLESPACE pg_default;

create index IF not exists order_drafts_session_id_idx on public.order_drafts using btree (session_id) TABLESPACE pg_default;

create trigger update_order_drafts_updated_at BEFORE
update on order_drafts for EACH row
execute FUNCTION update_updated_at_column ();

create table public."OrderStatusHistory" (
  id text not null default (gen_random_uuid ())::text,
  "orderId" text not null,
  "oldStatus" text null,
  "newStatus" text not null,
  "changedBy" text not null,
  "changedAt" timestamp with time zone null default now(),
  notes text null,
  constraint OrderStatusHistory_pkey primary key (id),
  constraint OrderStatusHistory_orderId_fkey foreign KEY ("orderId") references "Order" (id) on delete CASCADE,
  constraint OrderStatusHistory_changedBy_fkey foreign KEY ("changedBy") references "User" (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists "idx_OrderStatusHistory_orderId" on public."OrderStatusHistory" using btree ("orderId") TABLESPACE pg_default;

create index IF not exists "idx_OrderStatusHistory_changedAt" on public."OrderStatusHistory" using btree ("changedAt") TABLESPACE pg_default;

-- Wyzwalacz do automatycznego logowania zmian statusu
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Sprawdzamy, czy status faktycznie się zmienił
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public."OrderStatusHistory" (
            "orderId",
            "oldStatus",
            "newStatus",
            "changedBy",
            "changedAt",
            "notes"
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            COALESCE(NEW."userId", 'system'),
            COALESCE(NEW."updatedAt", NOW()),
            'Zmiana statusu zamówienia'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tworzenie wyzwalacza
DROP TRIGGER IF EXISTS trigger_order_status_change ON public."Order";
CREATE TRIGGER trigger_order_status_change
    AFTER UPDATE OF status
    ON public."Order"
    FOR EACH ROW
    EXECUTE FUNCTION log_order_status_change();

create table public.product_backup (
  id text null,
  name text null,
  description text null,
  price numeric(10, 2) null,
  category text null,
  code text null,
  availability text null,
  "productionPath" text null,
  dimensions text null,
  "imageUrl" text null,
  "createdAt" timestamp with time zone null,
  "updatedAt" timestamp with time zone null,
  identifier text null,
  index text null,
  "isActive" boolean null
) TABLESPACE pg_default;

