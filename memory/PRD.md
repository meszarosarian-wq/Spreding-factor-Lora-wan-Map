# LoRaWAN Coverage Monitor - PRD

## Problem Statement
Aplicație de monitorizare LoRaWAN care generează un heatmap de acoperire bazat pe parametrul Spreading Factor (SF), folosind date primite prin HTTP Webhooks de la un server ChirpStack.

## User Personas
- **Ingineri IoT**: Monitorizează acoperirea rețelei și performanța dispozitivelor
- **Administratori rețea LoRaWAN**: Gestionează gateway-uri și dispozitive, analizează calitatea semnalului

## Core Requirements
1. Management gateway-uri (CRUD)
2. Management dispozitive (CRUD + import CSV)
3. Webhook endpoint pentru ChirpStack UplinkEvent
4. Heatmap pe hartă cu colorare SF (Verde SF7-8, Portocaliu SF9-10, Roșu SF11-12)
5. Filtrare după gateway și interval de timp
6. Istoric uplink logs cu RSSI/SNR

## Architecture
- **Frontend**: React + TailwindCSS + Shadcn/UI + Leaflet.js
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Map Tiles**: CartoDB Dark Matter

## What's Been Implemented (Jan 2026)
- ✅ Dashboard cu hartă heatmap SF și statistici
- ✅ Pagină Gateway-uri cu CRUD complet
- ✅ Pagină Dispozitive cu CRUD + import CSV + download template
- ✅ Pagină Uplink Logs cu filtrare și test webhook
- ✅ Endpoint POST /api/chirpstack/webhook pentru ChirpStack
- ✅ Date demo: 1 gateway București + 5 dispozitive
- ✅ Dark theme "Tactical Minimalism"
- ✅ Filtre: gateway, dată început, dată sfârșit

## API Endpoints
- `GET/POST /api/gateways` - CRUD gateway-uri
- `GET/POST /api/devices` - CRUD dispozitive
- `POST /api/devices/import-csv` - Import CSV
- `GET /api/uplinks` - Istoric mesaje
- `POST /api/chirpstack/webhook` - Webhook ChirpStack
- `GET /api/heatmap` - Date pentru hartă
- `GET /api/stats` - Statistici dashboard
- `POST /api/seed` - Date demo

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Hartă cu heatmap SF
- [x] CRUD gateway-uri și dispozitive
- [x] Webhook ChirpStack
- [x] Import CSV

### P1 (High Priority)
- [ ] Export date uplink în CSV/Excel
- [ ] Notificări real-time pentru uplink-uri noi (WebSocket)
- [ ] Dashboard cu grafice statistice (RSSI/SNR în timp)

### P2 (Nice to Have)
- [ ] Autentificare utilizatori
- [ ] Alerte când SF > 10 pentru un dispozitiv
- [ ] Istoric heatmap (comparație pe zile)
- [ ] Mobile responsive optimization

## Next Tasks
1. Adăugare grafice statistice (RSSI mediu pe dispozitiv, distribuție SF)
2. WebSocket pentru actualizare în timp real
3. Export uplink logs în CSV
