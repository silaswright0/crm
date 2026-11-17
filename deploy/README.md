# Run MusterLog on a DigitalOcean droplet

A 2 GB Ubuntu droplet is enough for the app and Postgres together. Postgres stays on the same server. Later, a managed database is a swap of `DATABASE_URL`.

## 1. Droplet and DNS

Create an Ubuntu 24.04 droplet with 2 GB of memory. Point an A record at its address, for example `crm.example.com`.

## 2. Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Open a new shell so the docker group applies.

## 3. The app

Copy this project onto the droplet. In the project folder, create `.env`:

```bash
AUTH_SECRET=$(openssl rand -base64 32)
APP_URL=https://crm.example.com
POSTGRES_PASSWORD=$(openssl rand -base64 24)
```

`DATABASE_URL` is set inside Compose and points at the `postgres` service. Do not put the database on the public internet. The published Postgres port is for a machine you control. On the droplet, remove the `ports` mapping under `postgres` in `docker-compose.yml` if you do not want `5432` reachable.

Build and start:

```bash
docker compose up -d --build
```

The web container applies `drizzle/0000_init.sql` on boot, then listens on port 3000.

## 4. HTTPS with Caddy

Install Caddy, then use `deploy/Caddyfile`. Set the domain and start it:

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

```bash
export DOMAIN=crm.example.com
sudo mkdir -p /etc/caddy
envsubst < deploy/Caddyfile | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

`envsubst` is in `gettext`. Caddy asks Let’s Encrypt for a certificate and proxies to `localhost:3000`.

Open `https://crm.example.com`, create a workspace, and sign in. The first book is already filled with a sample studio so the boards are not empty.

Mail and Agents stay locked on the Counter plan. Settings has a local plan toggle for preview. It does not bill anyone, and it does not send mail or open an agent connection.

## Local development

Start only Postgres, migrate, and run the Next.js dev server:

```bash
docker compose up -d postgres
npm run db:migrate
npm run dev
```

Copy `.env.example` to `.env` first. `APP_URL` should be `http://localhost:3000`.
