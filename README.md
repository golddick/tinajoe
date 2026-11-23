# crumb.studio

## Setup

Install dependencies with `pnpm install`, copy `.env.example` to `.env.local`,
and fill in the database, Better Auth, DropAPHI, payment, email, and delivery
settings.

The first account to complete email verification becomes the studio admin;
admin signup closes once that account is verified. Signup accepts any email
address and does not use an `ADMIN_EMAIL` allowlist. Email verification uses a
DropAPHI OTP, then the admin signs in with their email and password.
After setup, administrators can invite team members from **Admin → Studio
settings → Admin team**. Invitations are sent by email, expire after seven
days, and can be revoked while pending. Invitees confirm their invited name
and email, set a password, and receive the same administrator access as the
existing team.

Better Auth serves signup and sign-in through the auth catch-all route:
`POST /api/auth/sign-up/email` accepts
`{ "name": "Studio owner", "email": "owner@example.com", "password": "..." }`,
and `POST /api/auth/sign-in/email` accepts
`{ "email": "owner@example.com", "password": "..." }`. Email OTPs are sent and
verified through `POST /api/admin/otp` with an `action` of `send` or `verify`.
The sign-in page also provides the first-admin signup and OTP verification flow.
Password recovery is available at `/admin/forgot-password`. It sends a
DropAPHI verification code to the admin email and uses Better Auth's
single-use, expiring password-reset token to update the password.
`POST /api/admin/password-reset` accepts `{ "action": "request", "email": "..." }`
to start recovery and `{ "action": "reset", "email": "...", "code": "123456",
"newPassword": "..." }` to complete it. The request response does not disclose
whether an email belongs to the admin.

## Database

The existing Better Auth tables are stored in the `neon_auth` schema. Bakery
tables are declared in `lib/db/schema.ts`. Set `DATABASE_URL` in `.env` or
`.env.local`, then run `pnpm db:migrate` to apply any pending SQL files in
`drizzle/` in filename order. The runner records applied migrations in
`public.cake_customization_migrations` and uses a PostgreSQL advisory lock to
prevent concurrent migration runs. The auth migration creates the `neon_auth`
schema and Better Auth tables when missing, and converts existing UUID columns
to text without changing existing key values. Better Auth generates new auth
IDs with DropID. Bakery-owned records also use DropID string IDs.
The first-admin migration preserves the earliest already-verified account as
the admin when upgrading an existing database.

## Checkout payments and order emails

Set `PAYSTACK_SECRET_KEY` to a Paystack test or live secret key and
`DROPAPHI_API_KEY` to a DropAPHI test or live API key. Keep these values
server-side. Configure a verified sender in the DropAPHI workspace for reliable
delivery. `BETTER_AUTH_URL` must be the canonical public site URL because
Paystack returns customers to the payment callback there.
Configure the Paystack webhook URL as
`https://<your-site>/api/payments/paystack/webhook`.

Customers are charged the full server-calculated cake total and, for delivery,
the verified delivery fee before their request enters the admin review queue.
The callback and signed Paystack webhook both verify the transaction amount and
currency before marking an order paid. DropAPHI sends the customer a payment
receipt and notifies the studio admin account when a paid request is ready for
review. Admin approval sends the customer note by email and moves the order to
**Cake confirmations**. Rejection requests a full Paystack refund to the
original payment method and emails the refund procedure. The admin dashboard
refreshes request/payment status while either order tab is open.

Paystack must accept the currencies enabled in **Price settings** for the
merchant account. If it does not support a selected currency, checkout shows
the gateway error rather than converting or silently changing the amount.
Run `pnpm db:migrate` after deploying to apply the paid-order migration.

## Product catalogue and market pricing

The migration seeds the editable default cake sizes, options, and collection
prices into `product_catalog`. Their market prices are intentionally blank and
must be entered in **Admin → Price settings** before cake estimates are
available. Save prices separately for NGN, EUR, and USD; amounts are never
derived from exchange rates. NGN is the default market and fallback when a
visitor's selected currency does not have a complete catalogue.

The price settings screen also lets the studio add catalogue entries by
selecting a product category, including cake sizes, flavours, frostings,
fillings, toppings, and standalone products. The selected category determines
the product type and where the entry is grouped; adding a product does not
create a new category. Standalone products appear as choices in the cake
builder and can be combined with the configured options. Each new item
receives only the explicitly entered currency price; enter its price
separately in other markets.
In price settings, use an item's remove control to deactivate just that product
or option (for example, one flavour or cake size). The category control
deactivates all products in that category. Both actions keep saved prices and
historical orders intact.

The storefront selects an initial market from the hosting request's country
header when available and remembers a visitor's manual currency selection.
Visitors can also change the display currency in the site header. Requests are
priced again on the server from the saved product-price rows.

Delivery base charges and additional per-kilometre rates are entered separately
for NGN, EUR, and USD in **Admin → Price settings**. The base charge covers the
first 5 km; the configured rate is added per kilometre beyond 5 km. The maximum
delivery radius is configured with the `Max_Km` environment variable (for
example, `Max_Km=40`), and quotes use the same market currency as the cake
estimate. No exchange-rate conversion or cross-market delivery fallback is
used. Set a market's per-kilometre rate to zero to use a flat charge within the
delivery area.

The admin gallery lets the studio create categories, upload JPG/PNG/WebP
images up to 2 MB, and edit or remove gallery entries. Public gallery images
are uploaded through the authenticated admin endpoint and stored as public
DropAPHI files in a folder named for their gallery category. Category folders
in the admin can be opened to browse their images. The storefront displays
four gallery cards and rotates through the saved images so entries beyond the
first four are shown over time.

## Delivery geocoding

> **Production note:** The public Nominatim service may not be suitable for
> AI-generated applications or sustained public traffic. Use a compatible
> provider or self-hosted service before deploying if your usage does not fit
> the public service's policy.

Set the bakery's full address in **Admin → Studio settings** and save it before
offering delivery. The admin and customer address pickers both show debounced
suggestions from Photon, an OpenStreetMap-based search-as-you-type service, and
include a Leaflet map for choosing a point directly. Selecting a point uses
Photon reverse geocoding to fill the address and postcode. The map opens near
the first matching search result, or in South London when no result is
available. Its tiles come from OpenStreetMap and display required attribution.
The default endpoint is `https://photon.komoot.io/api/`; override it with
`ADDRESS_SUGGESTIONS_API_URL` if you use another compatible HTTPS endpoint.
Photon's public demo server is intended for reasonable request volumes and may
throttle or block extensive usage; consider self-hosting for higher traffic.

After an address is selected, the existing Nominatim geocoder stores its
coordinates for delivery checks. Customer addresses are checked when a
delivery quote is requested. `NOMINATIM_API_URL` can point to a compatible
provider. Successful and empty address lookups are stored in PostgreSQL for 30
days (using a one-way hash of each query), and uncached requests are serialized
to stay within the public Nominatim service's one-request-per-second limit.
Address suggestions and geocoding display OpenStreetMap attribution.

If using the public Nominatim endpoint, follow its
[usage policy](https://operations.osmfoundation.org/policies/nominatim/):
keep usage moderate, retain the provider identification and caching, and be
prepared to switch to another provider. Customer-facing delivery checks include
OpenStreetMap attribution.

## DropAPHI

Set `DROPAPHI_API_KEY` to a server-side API key from the DropAPHI workspace.
The server uses `/api/v1/email/send` for payment, approval, refund, and paid
order-admin notifications, `/api/v1/otp/send` and `/api/v1/otp/verify` for
admin password recovery, and `/api/v1/files/upload` for cake inspiration and
gallery images. The API key is never sent to the browser. Configure a verified
sender in the DropAPHI workspace for reliable email delivery. Cake inspiration
uploads are limited to JPG, PNG, and WebP files up to 2 MB.
#   t i n a j o e  
 