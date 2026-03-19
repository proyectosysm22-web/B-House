-- Categorias de productos
alter table public.products
add column if not exists category text not null default 'comida';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_category_check'
  ) then
    alter table public.products
    add constraint products_category_check
    check (category in ('comida', 'bebida', 'ceramica'));
  end if;
end $$;

-- Campos de pago en orden
alter table public.orders
add column if not exists payment_method text,
add column if not exists paid_at timestamptz;

-- Facturas
create table if not exists public.invoices (
  id bigserial primary key,
  invoice_number text not null unique,
  order_id bigint not null references public.orders(id),
  table_id bigint references public.tables(id),
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
  id bigserial primary key,
  invoice_id bigint not null references public.invoices(id) on delete cascade,
  product_id bigint references public.products(id),
  product_name text not null,
  category text not null default 'comida' check (category in ('comida', 'bebida', 'ceramica')),
  quantity integer not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null
);

create index if not exists idx_invoices_order_id on public.invoices(order_id);
create index if not exists idx_invoices_created_at on public.invoices(created_at desc);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items(invoice_id);
