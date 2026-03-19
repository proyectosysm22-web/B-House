create extension if not exists pgcrypto;

-- Categorias en productos
alter table public.products
add column if not exists category text not null default 'comida';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_category_check'
  ) then
    alter table public.products
    add constraint products_category_check
    check (category in ('comida', 'bebida', 'ceramica'));
  end if;
end $$;

-- Trazabilidad y pago en ordenes
alter table public.orders
add column if not exists payment_method text,
add column if not exists paid_at timestamptz,
add column if not exists ready_at timestamptz,
add column if not exists delivered_at timestamptz;

-- Facturas (uuid compatible)
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid not null references public.orders(id),
  table_id uuid references public.tables(id),
  table_number integer,
  waiter_email text,
  cashier_email text,
  payment_method text not null check (payment_method in ('efectivo', 'transferencia')),
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'issued' check (status in ('issued', 'cancelled')),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  category text not null default 'comida' check (category in ('comida', 'bebida', 'ceramica')),
  quantity integer not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null
);

create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_waiter_email on public.orders(waiter_email);
create index if not exists idx_orders_payment_method on public.orders(payment_method);
create index if not exists idx_invoices_order_id on public.invoices(order_id);
create index if not exists idx_invoices_created_at on public.invoices(created_at desc);
create index if not exists idx_invoices_cashier_email on public.invoices(cashier_email);
create index if not exists idx_invoices_payment_method on public.invoices(payment_method);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items(invoice_id);
