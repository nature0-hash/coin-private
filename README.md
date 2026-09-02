# Coin Private

Coin Private is a Next.js crypto portfolio and trading application with separate customer and Management experiences. It includes portfolio views, market pricing, market trades, deposits, withdrawals, notifications, an audited wallet adjustment workflow, and configurable promotions.

## Local setup

Requirements: Node.js 20 or newer and Bun.

```bash
bun install
bun run db:push
bun run db:seed
bun run dev
```

Copy `.env.example` to `.env` before starting and provide a PostgreSQL connection string. Set a unique `SESSION_SECRET` for every shared or public environment.

### Demo accounts

These accounts are created only by the explicit seed command or when automatic demo seeding is allowed.

| Experience | Login | Password |
| --- | --- | --- |
| Management | `LUCIAN1975` | `PASSWORD@@1975` |
| Customer | `AMBER24` | `password123` |
| Customer | `MRC77` | `password123` |
| Customer | `SOF09` | `password123` |

Never enable demo seeding or use these credentials for a real-money deployment.

## First-week trading match

The first-week match is enabled by default and can be configured from Management platform settings.

- The eligibility window starts when the customer account is created and lasts seven days by default.
- The first eligible day on which executed trade volume reaches at least $1,000 establishes the daily target.
- The customer must meet that same target on three consecutive UTC calendar days.
- After day three, a 100% match of the target is credited to the USD promotional balance, subject to the configured cap.
- Only the promotional credit is reserved. The customer's principal remains available.
- The promotional credit becomes available at the end of the award month.
- Management can inspect progress, reset eligibility before an award, or release a locked award early. These actions are audited.

All amounts, percentages, durations, and caps can be changed in Management settings.

## Balance adjustments

Management can open a customer profile and choose **Adjust funds**. Credits and debits require a reason and are posted through the ledger. There is no unaudited set-balance endpoint. Debits are rejected when available funds are insufficient.

## Security notes

- Passwords are hashed with bcrypt.
- Session tokens are HMAC signed and expire after 12 hours.
- A dedicated `SESSION_SECRET` is strongly recommended. If omitted on Vercel, a stable deployment secret is derived from the private PostgreSQL connection string.
- Password reset codes use a cryptographically secure generator and are not returned by production APIs.
- Logout expires the HTTP-only session cookie.
- Two-factor authentication is not advertised because a real authenticator flow has not been configured.
- `.env` is ignored and is not tracked. Use `.env.example` as the template.

## Vercel deployment

The repository now uses persistent PostgreSQL and does not use Vercel temporary storage.

1. Import the repository into Vercel.
2. Open **Storage** in the Vercel project.
3. Create a **Prisma Postgres** or **Neon Postgres** database and connect it to the project. Vercel adds `DATABASE_URL` automatically.
4. Add a long random `SESSION_SECRET` in Vercel Environment Variables. This is recommended but the connected database also provides a stable private fallback.
5. Redeploy.

The Vercel build synchronizes the PostgreSQL schema before building. On the first login or registration request, the empty database receives the complete Coin Private setup. Users, passwords, balances, trades, notifications, promotion progress, and Management changes then remain saved in PostgreSQL across deployments and server restarts.

## Commands

```bash
bun run dev          # local development server
bun run lint         # ESLint
bun run db:generate  # generate Prisma client
bun run db:push      # synchronize the configured development database
bun run db:seed      # explicitly create demo data
bun run build        # production build
```

## Verification

```bash
bun run scripts/api-tests.ts
bun run scripts/check-integrity.ts
```

The API smoke battery covers authentication, trading, holds, deposits, withdrawals, approvals, promotions, wallet adjustments, reversals, registration, and password reset. Run it against a dedicated test database.
