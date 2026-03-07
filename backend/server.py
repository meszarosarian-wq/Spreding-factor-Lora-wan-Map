from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import csv
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Constants
SF_BUFFER_SIZE = 10  # Number of SF values to keep for averaging

# ==================== MODELS ====================

class Gateway(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dev_eui: Optional[str] = None  # Gateway DevEUI for identification
    name: str
    latitude: float
    longitude: float
    status: str = "active"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class GatewayCreate(BaseModel):
    dev_eui: Optional[str] = None
    name: str
    latitude: float
    longitude: float
    status: str = "active"

class Device(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dev_eui: str
    name: str
    latitude: float
    longitude: float
    last_seen: Optional[str] = None
    last_sf: Optional[int] = None
    sf_buffer: List[int] = Field(default_factory=list)  # Buffer of last 10 SF values
    sf_average: Optional[float] = None  # Calculated average of SF buffer
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class DeviceCreate(BaseModel):
    dev_eui: str
    name: str
    latitude: float
    longitude: float

class UplinkLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dev_eui: str
    device_name: Optional[str] = None
    device_registered: bool = False  # Flag to indicate if device is in our database
    gateway_id: Optional[str] = None
    gateway_name: Optional[str] = None
    gateway_registered: bool = False  # Flag to indicate if gateway is in our database
    rssi: int
    snr: float
    spreading_factor: int
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class StatsResponse(BaseModel):
    total_gateways: int
    total_devices: int
    total_uplinks: int
    uplinks_today: int
    sf_distribution: dict

# ==================== HELPER FUNCTIONS ====================

def calculate_sf_average(sf_buffer: List[int]) -> Optional[float]:
    """Calculate average SF from buffer"""
    if not sf_buffer:
        return None
    return round(sum(sf_buffer) / len(sf_buffer), 2)

def get_sf_color_category(sf_avg: Optional[float]) -> str:
    """Get color category based on average SF"""
    if sf_avg is None:
        return "unknown"
    if sf_avg <= 8.5:
        return "good"  # Green
    if sf_avg <= 10.5:
        return "medium"  # Orange
    return "bad"  # Red

# ==================== GATEWAY ENDPOINTS ====================

@api_router.get("/gateways", response_model=List[Gateway])
async def get_gateways():
    gateways = await db.gateways.find({}, {"_id": 0}).to_list(1000)
    return gateways

@api_router.get("/gateways/{gateway_id}", response_model=Gateway)
async def get_gateway(gateway_id: str):
    gateway = await db.gateways.find_one({"id": gateway_id}, {"_id": 0})
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway not found")
    return gateway

@api_router.post("/gateways", response_model=Gateway)
async def create_gateway(data: GatewayCreate):
    # Check if dev_eui already exists (if provided)
    if data.dev_eui:
        existing = await db.gateways.find_one({"dev_eui": data.dev_eui})
        if existing:
            raise HTTPException(status_code=400, detail="Gateway with this DevEUI already exists")
    
    gateway = Gateway(**data.model_dump())
    doc = gateway.model_dump()
    await db.gateways.insert_one(doc)
    return gateway

@api_router.put("/gateways/{gateway_id}", response_model=Gateway)
async def update_gateway(gateway_id: str, data: GatewayCreate):
    existing = await db.gateways.find_one({"id": gateway_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Gateway not found")
    
    # Check if dev_eui is being changed to one that already exists
    if data.dev_eui:
        duplicate = await db.gateways.find_one({"dev_eui": data.dev_eui, "id": {"$ne": gateway_id}})
        if duplicate:
            raise HTTPException(status_code=400, detail="Another gateway with this DevEUI already exists")
    
    update_data = data.model_dump()
    await db.gateways.update_one({"id": gateway_id}, {"$set": update_data})
    updated = await db.gateways.find_one({"id": gateway_id}, {"_id": 0})
    return updated

@api_router.delete("/gateways/{gateway_id}")
async def delete_gateway(gateway_id: str):
    result = await db.gateways.delete_one({"id": gateway_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Gateway not found")
    return {"message": "Gateway deleted successfully"}

# ==================== DEVICE ENDPOINTS ====================

@api_router.get("/devices")
async def get_devices():
    devices = await db.devices.find({}, {"_id": 0}).to_list(1000)
    # Ensure sf_buffer and sf_average are present
    for device in devices:
        if "sf_buffer" not in device:
            device["sf_buffer"] = []
        if "sf_average" not in device:
            device["sf_average"] = calculate_sf_average(device.get("sf_buffer", []))
    return devices

@api_router.get("/devices/{device_id}")
async def get_device(device_id: str):
    device = await db.devices.find_one({"id": device_id}, {"_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if "sf_buffer" not in device:
        device["sf_buffer"] = []
    if "sf_average" not in device:
        device["sf_average"] = calculate_sf_average(device.get("sf_buffer", []))
    return device

@api_router.post("/devices")
async def create_device(data: DeviceCreate):
    # Normalize DevEUI to uppercase for consistent matching
    normalized_dev_eui = data.dev_eui.upper().strip()
    
    # Check if dev_eui already exists
    existing = await db.devices.find_one({"dev_eui": normalized_dev_eui})
    if existing:
        raise HTTPException(status_code=400, detail="Device with this DevEUI already exists")
    
    device = Device(
        dev_eui=normalized_dev_eui,
        name=data.name,
        latitude=data.latitude,
        longitude=data.longitude
    )
    doc = device.model_dump()
    await db.devices.insert_one(doc)
    return device

@api_router.put("/devices/{device_id}")
async def update_device(device_id: str, data: DeviceCreate):
    existing = await db.devices.find_one({"id": device_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Device not found")
    
    update_data = data.model_dump()
    await db.devices.update_one({"id": device_id}, {"$set": update_data})
    updated = await db.devices.find_one({"id": device_id}, {"_id": 0})
    return updated

@api_router.delete("/devices/{device_id}")
async def delete_device(device_id: str):
    result = await db.devices.delete_one({"id": device_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"message": "Device deleted successfully"}

@api_router.post("/devices/import-csv")
async def import_devices_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    skipped = 0
    errors = []
    
    for row in reader:
        try:
            dev_eui = row.get('dev_eui') or row.get('DevEUI') or row.get('deveui')
            name = row.get('name') or row.get('Name') or row.get('device_name')
            latitude = row.get('latitude') or row.get('Latitude') or row.get('lat')
            longitude = row.get('longitude') or row.get('Longitude') or row.get('lng') or row.get('lon')
            
            if not all([dev_eui, name, latitude, longitude]):
                errors.append(f"Missing fields in row: {row}")
                skipped += 1
                continue
            
            # Normalize DevEUI to uppercase for consistent matching
            normalized_dev_eui = dev_eui.upper().strip()
            
            # Check if device already exists
            existing = await db.devices.find_one({"dev_eui": normalized_dev_eui})
            if existing:
                skipped += 1
                continue
            
            device = Device(
                dev_eui=normalized_dev_eui,
                name=name,
                latitude=float(latitude),
                longitude=float(longitude)
            )
            await db.devices.insert_one(device.model_dump())
            imported += 1
            
        except Exception as e:
            errors.append(f"Error processing row: {str(e)}")
            skipped += 1
    
    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:10]
    }

# ==================== UPLINK LOG ENDPOINTS ====================

@api_router.get("/uplinks", response_model=List[UplinkLog])
async def get_uplinks(
    gateway_id: Optional[str] = None,
    dev_eui: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100
):
    query = {}
    
    if gateway_id:
        query["gateway_id"] = gateway_id
    if dev_eui:
        query["dev_eui"] = dev_eui
    if start_date or end_date:
        query["timestamp"] = {}
        if start_date:
            query["timestamp"]["$gte"] = start_date
        if end_date:
            query["timestamp"]["$lte"] = end_date
    
    uplinks = await db.uplinks.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return uplinks

# ==================== UNREGISTERED DEVICES ENDPOINT ====================

@api_router.get("/unregistered-devices")
async def get_unregistered_devices():
    """
    Get list of DevEUIs that have sent data but are not registered in the devices collection
    """
    # Get all unique dev_euis from uplinks where device_registered is False
    pipeline = [
        {"$match": {"device_registered": False}},
        {"$group": {
            "_id": "$dev_eui",
            "last_seen": {"$max": "$timestamp"},
            "last_sf": {"$first": "$spreading_factor"},
            "last_rssi": {"$first": "$rssi"},
            "last_snr": {"$first": "$snr"},
            "message_count": {"$sum": 1}
        }},
        {"$sort": {"last_seen": -1}}
    ]
    
    unregistered = await db.uplinks.aggregate(pipeline).to_list(100)
    
    result = []
    for item in unregistered:
        # Double check it's not in devices collection
        existing = await db.devices.find_one({"dev_eui": item["_id"]})
        if not existing:
            result.append({
                "dev_eui": item["_id"],
                "last_seen": item["last_seen"],
                "last_sf": item["last_sf"],
                "last_rssi": item["last_rssi"],
                "last_snr": item["last_snr"],
                "message_count": item["message_count"]
            })
    
    return result

@api_router.post("/devices/quick-register")
async def quick_register_device(dev_eui: str, name: str, latitude: float = 0.0, longitude: float = 0.0):
    """
    Quick register a device from the Live Feed
    """
    # Check if already exists
    existing = await db.devices.find_one({"dev_eui": dev_eui})
    if existing:
        raise HTTPException(status_code=400, detail="Device with this DevEUI already exists")
    
    device = Device(
        dev_eui=dev_eui,
        name=name,
        latitude=latitude,
        longitude=longitude
    )
    await db.devices.insert_one(device.model_dump())
    
    # Update all existing uplinks for this device
    await db.uplinks.update_many(
        {"dev_eui": dev_eui},
        {"$set": {"device_name": name, "device_registered": True}}
    )
    
    return device

# ==================== CHIRPSTACK WEBHOOK ====================

@api_router.post("/chirpstack/webhook")
async def chirpstack_webhook(payload: dict):
    """
    Process ChirpStack UplinkEvent webhook
    Updates device's SF buffer (FIFO, max 10 values) and recalculates average
    """
    try:
        dev_eui = payload.get("devEui") or payload.get("deviceInfo", {}).get("devEui", "")
        
        # Extract spreading factor from txInfo
        tx_info = payload.get("txInfo", {})
        spreading_factor = None
        
        # Method 1: Direct spreadingFactor field
        if "loraModulationInfo" in tx_info:
            spreading_factor = tx_info["loraModulationInfo"].get("spreadingFactor")
        
        # Method 2: From dr (DataRate) - EU868 mapping
        if spreading_factor is None:
            dr = tx_info.get("dr")
            if dr is not None:
                sf_mapping = {0: 12, 1: 11, 2: 10, 3: 9, 4: 8, 5: 7}
                spreading_factor = sf_mapping.get(dr, 7)
        
        # Method 3: Direct sf field
        if spreading_factor is None:
            spreading_factor = tx_info.get("sf", 7)
        
        # Extract RSSI and SNR from rxInfo
        rx_info_list = payload.get("rxInfo", [])
        if not rx_info_list:
            rx_info_list = [{"gatewayId": "", "rssi": -100, "snr": 0}]
        
        # Find the device in our database
        device = await db.devices.find_one({"dev_eui": dev_eui})
        device_name = device.get("name") if device else None
        device_registered = device is not None
        
        # Create uplink logs for each gateway
        created_logs = []
        for rx_info in rx_info_list:
            gateway_id_raw = rx_info.get("gatewayId", "")
            rssi = rx_info.get("rssi", -100)
            snr = rx_info.get("snr", 0)
            
            # Try to find gateway by dev_eui first, then by id
            gateway = await db.gateways.find_one({"dev_eui": gateway_id_raw})
            if not gateway:
                gateway = await db.gateways.find_one({"id": gateway_id_raw})
            gateway_name = gateway.get("name") if gateway else None
            gateway_registered = gateway is not None
            
            uplink = UplinkLog(
                dev_eui=dev_eui,
                device_name=device_name,
                device_registered=device_registered,
                gateway_id=gateway_id_raw,
                gateway_name=gateway_name,
                gateway_registered=gateway_registered,
                rssi=int(rssi),
                snr=float(snr),
                spreading_factor=spreading_factor
            )
            
            await db.uplinks.insert_one(uplink.model_dump())
            created_logs.append(uplink)
        
        # Update device's SF buffer (FIFO) and recalculate average
        if device:
            sf_buffer = device.get("sf_buffer", [])
            
            # Add new SF value to buffer
            sf_buffer.append(spreading_factor)
            
            # Keep only last SF_BUFFER_SIZE values (FIFO)
            if len(sf_buffer) > SF_BUFFER_SIZE:
                sf_buffer = sf_buffer[-SF_BUFFER_SIZE:]
            
            # Calculate new average
            sf_average = calculate_sf_average(sf_buffer)
            
            await db.devices.update_one(
                {"dev_eui": dev_eui},
                {"$set": {
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                    "last_sf": spreading_factor,
                    "sf_buffer": sf_buffer,
                    "sf_average": sf_average
                }}
            )
        
        return {
            "status": "success",
            "message": f"Processed uplink from {dev_eui}",
            "logs_created": len(created_logs),
            "sf_buffer_size": len(device.get("sf_buffer", [])) + 1 if device else 0
        }
        
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== STATS ENDPOINT ====================

@api_router.get("/stats", response_model=StatsResponse)
async def get_stats():
    total_gateways = await db.gateways.count_documents({})
    total_devices = await db.devices.count_documents({})
    total_uplinks = await db.uplinks.count_documents({})
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    uplinks_today = await db.uplinks.count_documents({"timestamp": {"$gte": today_start}})
    
    pipeline = [
        {"$group": {"_id": "$spreading_factor", "count": {"$sum": 1}}}
    ]
    sf_results = await db.uplinks.aggregate(pipeline).to_list(20)
    sf_distribution = {str(r["_id"]): r["count"] for r in sf_results if r["_id"] is not None}
    
    return StatsResponse(
        total_gateways=total_gateways,
        total_devices=total_devices,
        total_uplinks=total_uplinks,
        uplinks_today=uplinks_today,
        sf_distribution=sf_distribution
    )

# ==================== HEATMAP DATA ENDPOINT ====================

@api_router.get("/heatmap")
async def get_heatmap_data(
    gateway_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Get device locations with their average SF values for heatmap visualization.
    Uses sf_average (from buffer of last 10 values) for coloring:
    - 7.0-8.5: Green (Good)
    - 8.6-10.5: Orange (Medium)
    - 10.6+: Red (Bad)
    """
    devices = await db.devices.find({}, {"_id": 0}).to_list(1000)
    
    uplink_query = {}
    if gateway_id:
        uplink_query["gateway_id"] = gateway_id
    if start_date or end_date:
        uplink_query["timestamp"] = {}
        if start_date:
            uplink_query["timestamp"]["$gte"] = start_date
        if end_date:
            uplink_query["timestamp"]["$lte"] = end_date
    
    # Optimized: Batch fetch latest uplinks for all devices in one query (avoid N+1)
    dev_euis = [d["dev_eui"] for d in devices]
    uplink_match = {**uplink_query, "dev_eui": {"$in": dev_euis}} if dev_euis else uplink_query
    
    pipeline = [
        {"$match": uplink_match},
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id": "$dev_eui",
            "rssi": {"$first": "$rssi"},
            "snr": {"$first": "$snr"},
            "timestamp": {"$first": "$timestamp"}
        }}
    ]
    
    latest_uplinks_list = await db.uplinks.aggregate(pipeline).to_list(1000)
    uplink_map = {u["_id"]: u for u in latest_uplinks_list}
    
    heatmap_points = []
    
    for device in devices:
        # Get latest uplink from pre-fetched map
        latest_uplink = uplink_map.get(device["dev_eui"])
        
        # Get SF average from device (calculated from buffer)
        sf_buffer = device.get("sf_buffer", [])
        sf_average = device.get("sf_average")
        
        # If no sf_average stored, calculate from buffer or use last_sf
        if sf_average is None:
            if sf_buffer:
                sf_average = calculate_sf_average(sf_buffer)
            elif device.get("last_sf"):
                sf_average = float(device.get("last_sf"))
        
        # Skip if no SF data and filters are applied
        if sf_average is None and (gateway_id or start_date or end_date):
            continue
        
        # Determine color category
        color_category = get_sf_color_category(sf_average)
        
        heatmap_points.append({
            "dev_eui": device["dev_eui"],
            "name": device["name"],
            "latitude": device["latitude"],
            "longitude": device["longitude"],
            "spreading_factor": device.get("last_sf"),
            "sf_average": sf_average,
            "sf_buffer": sf_buffer,
            "sf_buffer_size": len(sf_buffer),
            "color_category": color_category,
            "last_seen": device.get("last_seen"),
            "rssi": latest_uplink.get("rssi") if latest_uplink else None,
            "snr": latest_uplink.get("snr") if latest_uplink else None
        })
    
    return heatmap_points

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_demo_data():
    """Seed demo data: 1 gateway and 5 devices with SF buffers"""
    
    existing_gateways = await db.gateways.count_documents({})
    existing_devices = await db.devices.count_documents({})
    
    if existing_gateways > 0 or existing_devices > 0:
        return {"message": "Demo data already exists", "gateways": existing_gateways, "devices": existing_devices}
    
    # Create demo gateway with DevEUI
    gateway = Gateway(
        id="gw-bucuresti-centru",
        dev_eui="AA00BB11CC22DD33",
        name="Gateway București Centru",
        latitude=44.4268,
        longitude=26.1025,
        status="active"
    )
    await db.gateways.insert_one(gateway.model_dump())
    
    # Create 5 demo devices with SF buffers
    demo_devices = [
        {
            "dev_eui": "0011223344556601",
            "name": "Sensor Piața Universității",
            "latitude": 44.4353,
            "longitude": 26.1027,
            "last_sf": 7,
            "sf_buffer": [7, 7, 8, 7, 7, 8, 7, 7, 7, 8],  # Avg ~7.3
            "sf_average": 7.3
        },
        {
            "dev_eui": "0011223344556602",
            "name": "Sensor Parcul Herăstrău",
            "latitude": 44.4711,
            "longitude": 26.0762,
            "last_sf": 8,
            "sf_buffer": [8, 8, 8, 9, 8, 8, 7, 8, 8, 8],  # Avg ~8.0
            "sf_average": 8.0
        },
        {
            "dev_eui": "0011223344556603",
            "name": "Sensor Gara de Nord",
            "latitude": 44.4479,
            "longitude": 26.0694,
            "last_sf": 9,
            "sf_buffer": [9, 9, 10, 9, 9, 10, 9, 9, 10, 9],  # Avg ~9.3
            "sf_average": 9.3
        },
        {
            "dev_eui": "0011223344556604",
            "name": "Sensor Baneasa",
            "latitude": 44.5013,
            "longitude": 26.0827,
            "last_sf": 10,
            "sf_buffer": [10, 10, 10, 11, 10, 10, 9, 10, 10, 10],  # Avg ~10.0
            "sf_average": 10.0
        },
        {
            "dev_eui": "0011223344556605",
            "name": "Sensor Măgurele",
            "latitude": 44.3479,
            "longitude": 26.0299,
            "last_sf": 12,
            "sf_buffer": [11, 12, 12, 11, 12, 12, 11, 12, 12, 12],  # Avg ~11.7
            "sf_average": 11.7
        },
    ]
    
    for dev_data in demo_devices:
        device = Device(
            dev_eui=dev_data["dev_eui"],
            name=dev_data["name"],
            latitude=dev_data["latitude"],
            longitude=dev_data["longitude"],
            last_sf=dev_data["last_sf"],
            sf_buffer=dev_data["sf_buffer"],
            sf_average=dev_data["sf_average"]
        )
        await db.devices.insert_one(device.model_dump())
    
    # Create demo uplink logs
    demo_uplinks = [
        UplinkLog(
            dev_eui="0011223344556601",
            device_name="Sensor Piața Universității",
            gateway_id="gw-bucuresti-centru",
            gateway_name="Gateway București Centru",
            rssi=-65,
            snr=10.5,
            spreading_factor=7
        ),
        UplinkLog(
            dev_eui="0011223344556602",
            device_name="Sensor Parcul Herăstrău",
            gateway_id="gw-bucuresti-centru",
            gateway_name="Gateway București Centru",
            rssi=-78,
            snr=8.2,
            spreading_factor=8
        ),
        UplinkLog(
            dev_eui="0011223344556603",
            device_name="Sensor Gara de Nord",
            gateway_id="gw-bucuresti-centru",
            gateway_name="Gateway București Centru",
            rssi=-92,
            snr=4.5,
            spreading_factor=9
        ),
        UplinkLog(
            dev_eui="0011223344556604",
            device_name="Sensor Baneasa",
            gateway_id="gw-bucuresti-centru",
            gateway_name="Gateway București Centru",
            rssi=-105,
            snr=1.2,
            spreading_factor=10
        ),
        UplinkLog(
            dev_eui="0011223344556605",
            device_name="Sensor Măgurele",
            gateway_id="gw-bucuresti-centru",
            gateway_name="Gateway București Centru",
            rssi=-118,
            snr=-5.3,
            spreading_factor=12
        ),
    ]
    
    for uplink in demo_uplinks:
        await db.uplinks.insert_one(uplink.model_dump())
    
    return {
        "message": "Demo data seeded successfully",
        "gateways": 1,
        "devices": 5,
        "uplinks": 5
    }

# ==================== ROOT ENDPOINT ====================

@api_router.get("/")
async def root():
    return {"message": "LoRaWAN Coverage Monitor API", "version": "1.1.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
