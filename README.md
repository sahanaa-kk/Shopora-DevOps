# Shopora — Complete E-Commerce Demo

A complete local learning project using React + Vite, Node.js + Express, MongoDB, Docker and Docker Compose.

## Requirements
- Docker Desktop installed and running
- VS Code (recommended)

## Run on Windows
1. Extract this folder.
2. Open the `Shopora-Complete` folder in VS Code.
3. Open Terminal > New Terminal (PowerShell).
4. Run:

   ```powershell
   docker compose up --build -d
   ```

5. Open http://localhost:8080

API:
- http://localhost:5000/api/health
- http://localhost:5000/api/products

## Useful commands
```powershell
docker compose ps
docker compose logs --tail=80 backend
docker compose logs --tail=80 frontend
docker compose down
```

To reset the sample database completely:
```powershell
docker compose down -v
docker compose up --build -d
```
Warning: `down -v` deletes the MongoDB volume and all local Shopora database data.

## Features
- Product catalogue loaded from MongoDB API
- Search by product name and description
- Category filters
- Product detail modal
- Add-to-bag cart, quantity changes and item removal
- Wishlist toggle (browser session only)
- Responsive desktop/mobile layout
- Docker Compose for frontend, backend and database

This is a college/demo project. The cart is client-side only; there is no account system, order persistence, payment gateway or real checkout.
