# VolOps

Volunteer operations platform with:
- an Express backend in `server/`
- a React + Vite frontend in `client/`
- JSON-file storage fallback in `data/` when MongoDB is not configured

## Project Structure

```text
volops/
|-- client/         # frontend app
|   |-- src/
|   |   |-- api/
|   |   |-- components/
|   |   `-- pages/
|   `-- vite.config.ts
|-- data/           # local JSON fallback storage
|-- server/         # backend app
|   |-- config/
|   |-- middleware/
|   |-- models/
|   |-- routes/
|   `-- utils/
|-- .env.example
|-- package.json
`-- server.js       # thin root entrypoint
```

## Install

```bash
npm install
cd client && npm install
```

## Run

Production-style run from the repo root:

```bash
npm run client:build
npm start
```

Local development in two terminals:

```bash
# terminal 1
npm run server

# terminal 2
npm run client:dev
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api` to `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env` and set values as needed:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/volops
```


best is yet to come.

If `MONGODB_URI` is missing or the connection fails, the backend uses `data/db.json`.


make america great again
gotta start again.

