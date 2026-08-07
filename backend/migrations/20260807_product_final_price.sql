-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
--
-- Replaces the free-text "offer" field (e.g. "10% off") with an explicit
-- final_price column. Admins now type the actual selling price; the
-- discount percentage shown to customers is derived from price vs
-- final_price at display time (see common.js ssdPriceBreakdown), not
-- stored separately, so it can never drift out of sync.

alter table public.products
  add column if not exists final_price numeric;

-- Backfill existing rows from the old "offer" text so nothing changes on
-- the storefront until each product is re-saved from the admin panel.
update public.products
set final_price = round(price * (1 - (substring(offer from '(\d+(\.\d+)?)')::numeric / 100)))
where final_price is null
  and offer ~ '\d'
  and price > 0;

-- Everything else (no discount): final_price = price.
update public.products
set final_price = price
where final_price is null;
