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

## What's Been Implemented

### v1.0 - MVP (Jan 2026)
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
- ✅ **Puncte variabile**: Dimensiune punct pe hartă bazată pe SF

### v1.2 - Search, Sort & Export (Jan 2026)
- ✅ **Search pe toate paginile**: Gateways, Devices, Live Feed - căutare după nume, DevEUI, gateway
- ✅ **Sort pe toate coloanele**: Click pe header pentru sortare ascendentă/descendentă
- ✅ **Filtre avansate**: 
  - Gateways: Status (Active/Inactive)
  - Devices: Calitate SF (Excelent/Mediu/Slab/Fără date)
  - Live Feed: Status înregistrare (Înregistrate/Neînregistrate)
- ✅ **Export CSV**: Buton Export pe toate cele 3 pagini (Gateways, Devices, Live Feed)
- ✅ **Counter filtre**: Afișare "X din Y" pentru rezultate filtrate
- ✅ **Resetare filtre**: Buton pentru resetarea tuturor filtrelor

### v1.3 - NOC Features (Mar 2026)
- ✅ **Packet Loss Detection (fCnt)**: Extragere fCnt din webhook, calcul pachete pierdute, alertă consecutiv >3
- ✅ **Battery Level Monitoring**: Extragere baterie din payload object/deviceStatus, alertă sub 20%
- ✅ **Hartă NOC**: Culori noi (Verde SF≤9, Portocaliu SF=10, Roșu SF≥11 sau offline >24h)
- ✅ **Alerte NOC**: Panou alerte pe Dashboard și Analytics (packet loss, baterie, offline)
- ✅ **Analytics Page cu 4 Grafice**:
  - SF Distribution (Donut Chart) - procentaj per SF în rețea
  - Top 10 Noduri cu Probleme (Bar Chart) - pachete pierdute sau SNR scăzut
  - Evoluție Calitate RF (Line Chart) - RSSI/SNR pe 7 zile per nod
  - Încărcare Gateway (Area Chart) - uplinks/oră pentru monitorizare Duty Cycle

## API Endpoints
- `GET/POST /api/gateways` - CRUD gateway-uri (include dev_eui)
- `GET/POST /api/devices` - CRUD dispozitive (include sf_buffer, sf_average)
- `POST /api/devices/import-csv` - Import CSV
- `GET /api/uplinks` - Istoric mesaje
- `POST /api/chirpstack/webhook` - Webhook ChirpStack (actualizează buffer)
- `GET /api/heatmap` - Date pentru hartă (include sf_average, sf_buffer_size, battery_level, packets_lost)
- `GET /api/stats` - Statistici dashboard
- `GET /api/alerts` - Alerte NOC active (packet loss, baterie, offline)
- `GET /api/analytics/sf-distribution` - Distribuție SF pentru Donut Chart
- `GET /api/analytics/top-problematic` - Top 10 noduri problematice (metric=packet_loss|snr)
- `GET /api/analytics/rf-quality/{dev_eui}` - Evoluție RSSI/SNR pe 7 zile
- `GET /api/analytics/gateway-load` - Trafic gateway pe oră
- `GET /api/analytics/device-list` - Lista dispozitive pentru selectoare
- `POST /api/seed` - Date demo

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Hartă cu heatmap SF
- [x] CRUD gateway-uri și dispozitive
- [x] Webhook ChirpStack
- [x] Import CSV
- [x] Buffer SF cu mediere (10 valori)
- [x] DevEUI pentru gateway-uri
- [x] Search/Sort pe toate tabelele
- [x] Export CSV pentru toate datele

### P1 (High Priority)
- [ ] Notificări real-time pentru uplink-uri noi (WebSocket)
- [ ] Dashboard cu grafice statistice (RSSI/SNR în timp)

### P2 (Nice to Have)
- [ ] Autentificare utilizatori
- [ ] Alerte când media SF > 10.5 pentru un dispozitiv
- [ ] Istoric heatmap (comparație pe zile)
- [ ] Mobile responsive optimization

## Next Tasks
1. Implementare WebSocket pentru actualizare în timp real a Live Feed
2. Adăugare grafice statistice (RSSI mediu pe dispozitiv, distribuție SF)
3. Alerte automate pentru dispozitive cu SF slab
