# URL Shortener

A URL shortener with user accounts. Users sign up, log in, turn long URLs into short codes (random or custom), see their own links, and delete them. Anyone who opens a short link is redirected to the original URL.

Built for the Cloud Computing mini project. Area: **Cloud Database** (PostgreSQL), with the whole system containerized using **Docker Compose**.

## Features

- Sign up and log in (passwords are salted and hashed, never stored in plain text)
- JWT authentication for private routes
- Create short URLs, with an optional custom short code
- List and delete your own links (a user cannot delete someone else's link)
- Public redirect: opening `/<shortCode>` sends you to the original URL
- Duplicate custom codes return a clear error instead of crashing the server
- Web frontend served by the same Express app (no Postman needed)
- Health check endpoint at `/health`

## Tech stack

| Part | Technology |
| --- | --- |
| Backend | Node.js 22, Express 4 |
| Database | PostgreSQL 17 |
| ORM | Drizzle ORM (`drizzle-kit push` creates the tables) |
| Validation | Zod |
| Auth | JWT (`jsonwebtoken`) |
| Short codes | nanoid |
| Frontend | Plain HTML, CSS and JavaScript (`public/`) |
| Containers | Docker, Docker Compose |

## How it runs

`docker compose up` starts two containers on a private network:

- `db`: PostgreSQL. Its data is stored in the named volume `pg_data`, so it survives restarts. A healthcheck (`pg_isready`) tells Compose when it is ready.
- `app`: the Node/Express server. It waits for `db` to be healthy, runs `pnpm db:push` to create the tables, then starts on port 8000.

Inside the Docker network the app reaches the database at `db:5432`. From your own machine, Postgres is exposed on `localhost:5433`.

## Run with Docker (recommended)

You need Docker with the Compose plugin.

```bash
git clone https://github.com/Soham-Ghorpade/url-shortener.git
cd url-shortener
cp .env.example .env
```

Open `.env` and set your own `JWT_SECRET` and `POSTGRES_PASSWORD`. Then:

```bash
docker compose up -d --build
```

Open http://localhost:8000.

Useful commands:

```bash
docker compose ps              # what is running
docker compose logs -f app     # live app logs
docker compose down            # stop and remove containers (data is kept)
docker compose down -v         # also delete the database volume (data is lost)
```

## Run locally without Docker for the app

Start only the database in Docker, then run the app with Node:

```bash
docker compose up -d db
pnpm install
pnpm db:push        # create the tables
pnpm dev
```

Your `.env` for this mode needs `DATABASE_URL=postgres://postgres:<password>@localhost:5433/postgres`.

## Environment variables

See `.env.example`. Never commit your real `.env`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Connection string used when running the app outside Docker |
| `JWT_SECRET` | Secret used to sign and verify login tokens |
| `POSTGRES_PASSWORD` | Password for the Postgres container (also used to build the app's database URL in Docker) |

## API

Private routes need the header `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Body | Success response |
| --- | --- | --- | --- | --- |
| POST | `/user/signup` | No | `firstname`, `lastname`, `email`, `password` | `201` `{ data: { userId } }` |
| POST | `/user/login` | No | `email`, `password` | `200` `{ token }` |
| POST | `/shorten` | Yes | `url`, optional `code` | `201` `{ id, shortCode, targetURL }` |
| GET | `/codes` | Yes | none | `200` `{ codes: [...] }` (your links only) |
| DELETE | `/:id` | Yes | none | `200` `{ deleted: true }` |
| GET | `/:shortCode` | No | none | Redirect to the original URL, or `404` |
| GET | `/health` | No | none | `{ status: ... }` |

Errors: `400` for invalid input, `401` when you are not logged in, `409` when a custom code is already taken.

## Project structure

```
db/            database connection (Drizzle)
models/        table definitions (users, urls)
routes/        user and URL routes
middlewares/   authentication middleware
services/      database helper functions
utils/         password hashing and token helpers
validation/    Zod schemas for request bodies
public/        frontend (index.html, styles.css, app.js)
Dockerfile
docker-compose.yml
```
