# URL Shortener

A URL shortener with user accounts. Users sign up, log in, turn long URLs into short codes (random or custom), see their own links, and delete them. Anyone who opens a short link is redirected to the original URL.

Built for the Cloud Computing mini project. Area: **Cloud Database**. The data lives in a managed PostgreSQL database on **Neon** (AWS, Singapore region), and the application is containerized with **Docker**. A fully local setup with Docker Compose is included as a fallback.

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
| Database (main) | Managed PostgreSQL on Neon (free plan, AWS Singapore) |
| Database (local fallback) | PostgreSQL 17 in a Docker container |
| ORM | Drizzle ORM (`drizzle-kit push` creates the tables) |
| Validation | Zod |
| Auth | JWT (`jsonwebtoken`) |
| Short codes | nanoid |
| Frontend | Plain HTML, CSS and JavaScript (`public/`) |
| Containers | Docker, Docker Compose |

## Architecture

The project has two tiers that run in different places:

```
Browser  ->  App (Express, in Docker or on the laptop)  ->  Neon PostgreSQL (cloud, over SSL)
```

- **App tier:** the Express server, packaged as a Docker image, running on the local machine.
- **Database tier:** a managed PostgreSQL database hosted by Neon. The app finds it only through the `DATABASE_URL` environment variable, so switching to a different database means changing one setting, not the code.
- **Configuration:** the database URL and the JWT secret are read from environment variables. Secrets are never stored in the code or the repository.

## Two ways to run it

| | Cloud database (main) | Everything local (fallback) |
| --- | --- | --- |
| Database | Neon (cloud) | Postgres container with the `pg_data` volume |
| Compose file | `docker-compose.neon.yml` | `docker-compose.yml` |
| Needs internet | Yes | No |
| Needs in `.env` | `DATABASE_URL`, `JWT_SECRET` | `POSTGRES_PASSWORD`, `JWT_SECRET` |

Run only one at a time, because both use port 8000. The two databases are separate, so users created in one do not exist in the other.

## Run with the Neon cloud database (main)

You need Docker with the Compose plugin and a free Neon account.

1. Create a free project at neon.com. In the project, click **Connect**, turn **Connection pooling** off, and copy the connection string (it starts with `postgresql://`). If it ends with `&channel_binding=require`, remove that part.
2. Clone the repo and create your `.env`:

```bash
git clone https://github.com/Soham-Ghorpade/url-shortener.git
cd url-shortener
cp .env.example .env
```

3. Open `.env` and set `DATABASE_URL` to your Neon connection string and `JWT_SECRET` to any long random string. Never commit this file.
4. Start the app:

```bash
docker compose -f docker-compose.neon.yml up -d --build
```

5. Open http://localhost:8000. On start, the app runs `pnpm db:push` to create the tables in Neon.

Stop it with:

```bash
docker compose -f docker-compose.neon.yml down
```

Your data stays in Neon, so stopping the container loses nothing.

You can also run the app without Docker:

```bash
pnpm install
pnpm db:push        # create the tables in Neon
pnpm dev
```

Notes for the free plan: the database goes to sleep when idle, so the first request after a break can take a few seconds. If Node prints an SSL mode warning, you can change `sslmode=require` to `sslmode=verify-full` at the end of the connection string.

## Run everything locally with Docker (fallback)

This starts the app and a Postgres container together, with no internet or Neon account needed.

```bash
cp .env.example .env
```

Set `POSTGRES_PASSWORD` and `JWT_SECRET` in `.env`, then:

```bash
docker compose up -d --build
```

Open http://localhost:8000.

How it works: `docker compose up` starts two containers on a private network.

- `db`: PostgreSQL. Its data is stored in the named volume `pg_data`, so it survives restarts. A healthcheck (`pg_isready`) tells Compose when it is ready.
- `app`: the Node/Express server. It waits for `db` to be healthy, runs `pnpm db:push` to create the tables, then starts on port 8000.

Inside the Docker network the app reaches the database at `db:5432`. From your own machine, Postgres is exposed on `localhost:5433`. In this mode the compose file builds its own database address, so the `DATABASE_URL` line in `.env` is ignored.

Useful commands:

```bash
docker compose ps              # what is running
docker compose logs -f app     # live app logs
docker compose down            # stop and remove containers (data is kept)
docker compose down -v         # also delete the database volume (data is lost)
```

## Environment variables

See `.env.example`. Never commit your real `.env`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Connection string of the database. Use your Neon string for the cloud setup. Also used by `pnpm dev`, `pnpm db:push` and `pnpm db:studio` |
| `JWT_SECRET` | Secret used to sign and verify login tokens |
| `POSTGRES_PASSWORD` | Password for the local Postgres container (local fallback only) |

## Cloud computing concepts shown

- **Managed cloud database:** the data is stored in a PostgreSQL service hosted by Neon, not on the application machine.
- **Separate tiers:** the application and the database are independent and talk over an encrypted network connection.
- **Configuration through the environment:** the same code works against a local or a cloud database by changing `DATABASE_URL`.
- **Containers:** the application is packaged as a Docker image, so it runs the same way on any machine.
- **Persistent storage (local setup):** a named Docker volume keeps the database files when containers are removed.
- **Health checks and startup order (local setup):** the app waits until the database reports healthy.

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
db/                      database connection (Drizzle)
models/                  table definitions (users, urls)
routes/                  user and URL routes
middlewares/             authentication middleware
services/                database helper functions
utils/                   password hashing and token helpers
validation/              Zod schemas for request bodies
public/                  frontend (index.html, styles.css, app.js)
Dockerfile               image for the app
docker-compose.neon.yml  app only, uses the Neon cloud database
docker-compose.yml       app + local Postgres (fallback)
```