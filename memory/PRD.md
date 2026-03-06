# LoRaWAN Coverage Monitor - PRD

## Problem Statement
Aplicație de monitorizare LoRaWAN care generează un heatmap de acoperire bazat pe parametrul Spreading Factor (SF), folosind date primite prin HTTP Webhooks de la un server ChirpStack.

## User Personas
- **Ingineri IoT**: Monitorizează acoperirea rețelei și performanța dispozitivelor
- **Administratori rețea LoRaWAN**: Gestionează gateway-uri și dispozitive, analizează calitatea semnalului

## Core Requirements
1. Management gateway-uri (CRUD + DevEUI)
2. Management dispozitive (CRUD + import CSV + buffer SF)
3. Webhook endpoint pentru ChirpStack UplinkEvent
4. Heatmap pe hartă cu colorare SF bazată pe MEDIA ultimelor 10 valori
5. Filtrare după gateway și interval de timp
6. Istoric uplink logs cu RSSI/SNR

## Architecture
- **Frontend**: React + TailwindCSS + Shadcn/UI + Leaflet.js
- **Backend**: FastAPI (Python) v1.1.0
- **Database**: MongoDB
- **Map Tiles**: CartoDB Dark Matter

## What's Been Implemented (Jan 2026)

### v1.0 - MVP
- ✅ Dashboard cu hartă heatmap SF și statistici
- ✅ Pagină Gateway-uri cu CRUD complet
- ✅ Pagină Dispozitive cu CRUD + import CSV + download template
- ✅ Pagină Uplink Logs cu filtrare și test webhook
- ✅ Endpoint POST /api/chirpstack/webhook pentru ChirpStack
- ✅ Date demo: 1 gateway București + 5 dispozitive
- ✅ Dark theme "Tactical Minimalism"
- ✅ Filtre: gateway, dată început, dată sfârșit

### v1.1 - SF Buffer System (Jan 2026)
- ✅ **Buffer SF**: Fiecare dispozitiv păstrează ultimele 10 valori SF (FIFO)
- ✅ **Media SF**: Heatmap folosește media aritmetică a buffer-ului pentru colorare
- ✅ **Praguri noi**: ≤8.5 Verde (Excelent), 8.6-10.5 Portocaliu (Mediu), >10.5 Roșu (Limită)
- ✅ **DevEUI Gateway**: Câmp opțional pentru identificare gateway în ChirpStack
- ✅ **Vizualizare Buffer**: Dialog pentru a vedea toate valorile SF din buffer
- ✅ **Puncte variabile**: Dimensiune punct pe hartă bazată pe SF (mai mare = acoperire mai slabă)

## API Endpoints
- `GET/POST /api/gateways` - CRUD gateway-uri (include dev_eui)
- `GET/POST /api/devices` - CRUD dispozitive (include sf_buffer, sf_average)
- `POST /api/devices/import-csv` - Import CSV
- `GET /api/uplinks` - Istoric mesaje
- `POST /api/chirpstack/webhook` - Webhook ChirpStack (actualizează buffer)
- `GET /api/heatmap` - Date pentru hartă (include sf_average, sf_buffer_size)
- `GET /api/stats` - Statistici dashboard
- `POST /api/seed` - Date demo

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Hartă cu heatmap SF
- [x] CRUD gateway-uri și dispozitive
- [x] Webhook ChirpStack
- [x] Import CSV
- [x] Buffer SF cu mediere (10 valori)
- [x] DevEUI pentru gateway-uri

### P1 (High Priority)
- [ ] Export date uplink în CSV/Excel
- [ ] Notificări real-time pentru uplink-uri noi (WebSocket)
- [ ] Dashboard cu grafice statistice (RSSI/SNR în timp)

### P2 (Nice to Have)
- [ ] Autentificare utilizatori
- [ ] Alerte când media SF > 10.5 pentru un dispozitiv
- [ ] Istoric heatmap (comparație pe zile)
- [ ] Mobile responsive optimization

## Next Tasks
1. Adăugare grafice statistice (RSSI mediu pe dispozitiv, distribuție SF)
2. WebSocket pentru actualizare în timp real
3. Export uplink logs în CSV
