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
from datetime import datetime, timezone, timedelta
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
    # NOC Fields
    last_fcnt: Optional[int] = None  # Last frame counter received
    packets_lost: int = 0  # Total packets lost (cumulative)
    consecutive_lost: int = 0  # Consecutive packets lost (resets on successful reception)
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
    # NOC Fields
    fcnt: Optional[int] = None  # Frame counter from ChirpStack
    frequency: Optional[int] = None  # Frequency in Hz (e.g. 868100000)
    packets_lost: int = 0  # Packets lost detected at this uplink
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
    DevEUI is normalized to UPPERCASE
    """
    # Normalize DevEUI to uppercase
    normalized_dev_eui = dev_eui.upper().strip()
    
    # Check if already exists
    existing = await db.devices.find_one({"dev_eui": normalized_dev_eui})
    if existing:
        raise HTTPException(status_code=400, detail="Device with this DevEUI already exists")
    
    device = Device(
        dev_eui=normalized_dev_eui,
        name=name,
        latitude=latitude,
        longitude=longitude
    )
    await db.devices.insert_one(device.model_dump())
    
    # Update all existing uplinks for this device (check both cases)
    await db.uplinks.update_many(
        {"$or": [{"dev_eui": normalized_dev_eui}, {"dev_eui": dev_eui}]},
        {"$set": {"dev_eui": normalized_dev_eui, "device_name": name, "device_registered": True}}
    )
    
    return device

# ==================== CHIRPSTACK WEBHOOK ====================

@api_router.post("/chirpstack/webhook")
async def chirpstack_webhook(payload: dict):
    """
    Process ChirpStack UplinkEvent webhook
    Updates device's SF buffer (FIFO, max 10 values) and recalculates average
    Extracts fCnt for packet loss detection and battery level
    Matches device by DevEUI (primary) or by Name (secondary)
    """
    try:
        raw_dev_eui = payload.get("devEui") or payload.get("deviceInfo", {}).get("devEui", "")
        device_name_from_payload = payload.get("deviceName") or payload.get("deviceInfo", {}).get("deviceName", "")
        
        # NORMALIZE DevEUI to UPPERCASE for consistent matching
        dev_eui = raw_dev_eui.upper().strip()
        
        # ===== EXTRACT fCnt (Frame Counter) =====
        fcnt = None
        try:
            fcnt = payload.get("fCnt") or payload.get("fCntUp")
            if fcnt is None:
                device_info = payload.get("deviceInfo", {})
                fcnt = device_info.get("fCnt") or device_info.get("fCntUp")
            if fcnt is not None:
                fcnt = int(fcnt)
                logger.info(f"fCnt extracted: {fcnt}")
        except (ValueError, TypeError) as e:
            logger.warning(f"Could not extract fCnt: {e}")
            fcnt = None
        
        # ===== EXTRACT Frequency =====
        frequency = None
        try:
            tx_info_freq = payload.get("txInfo", {})
            frequency = tx_info_freq.get("frequency")
            if frequency is None:
                frequency = payload.get("frequency")
            if frequency is not None:
                frequency = int(frequency)
                logger.info(f"Frequency extracted: {frequency} Hz")
        except (ValueError, TypeError) as e:
            logger.warning(f"Could not extract frequency: {e}")
            frequency = None
        
        # Extract spreading factor - check multiple locations
        spreading_factor = None
        
        # Method 1: Direct at root level (ChirpStack v4 format)
        if payload.get("spreadingFactor") is not None:
            spreading_factor = payload.get("spreadingFactor")
            logger.info(f"SF from root level: {spreading_factor}")
        
        # Method 2: From rxInfo array (can contain SF per gateway)
        rx_info_list = payload.get("rxInfo", [])
        if spreading_factor is None and rx_info_list:
            for rx_info in rx_info_list:
                if rx_info.get("spreadingFactor") is not None:
                    spreading_factor = rx_info.get("spreadingFactor")
                    logger.info(f"SF from rxInfo: {spreading_factor}")
                    break
        
        # Method 3: From txInfo.loraModulationInfo
        tx_info = payload.get("txInfo", {})
        if spreading_factor is None and "loraModulationInfo" in tx_info:
            spreading_factor = tx_info["loraModulationInfo"].get("spreadingFactor")
            if spreading_factor:
                logger.info(f"SF from txInfo.loraModulationInfo: {spreading_factor}")
        
        # Method 4: From dr (DataRate) field - EU868 mapping
        if spreading_factor is None:
            dr = payload.get("dr") or tx_info.get("dr")
            if dr is not None:
                sf_mapping = {0: 12, 1: 11, 2: 10, 3: 9, 4: 8, 5: 7}
                spreading_factor = sf_mapping.get(dr, 7)
                logger.info(f"SF from dr={dr} mapping: {spreading_factor}")
        
        # Method 5: Direct sf field in txInfo
        if spreading_factor is None:
            spreading_factor = tx_info.get("sf")
            if spreading_factor:
                logger.info(f"SF from txInfo.sf: {spreading_factor}")
        
        # Default fallback
        if spreading_factor is None:
            spreading_factor = 7
            logger.warning(f"SF not found in payload, using default: {spreading_factor}")
        
        # Ensure SF is integer
        spreading_factor = int(spreading_factor)
        
        # Extract RSSI and SNR from rxInfo or root level
        if not rx_info_list:
            # Build rxInfo from root level fields if not present
            rx_info_list = [{
                "gatewayId": payload.get("gatewayId", ""),
                "rssi": payload.get("rssi", -100),
                "snr": payload.get("snr", 0)
            }]
        
        # Find the device in our database:
        # 1. First try by DevEUI (normalized uppercase)
        device = await db.devices.find_one({"dev_eui": dev_eui})
        
        # 2. If not found by DevEUI, try by name (case-insensitive)
        if not device and device_name_from_payload:
            device = await db.devices.find_one({
                "name": {"$regex": f"^{device_name_from_payload}$", "$options": "i"}
            })
            # If found by name, update the device's DevEUI for future matching
            if device:
                await db.devices.update_one(
                    {"id": device["id"]},
                    {"$set": {"dev_eui": dev_eui}}
                )
                logger.info(f"Updated device {device['name']} with DevEUI {dev_eui}")
        
        device_name = device.get("name") if device else device_name_from_payload or None
        device_registered = device is not None
        
        # ===== CALCULATE PACKET LOSS (fCnt gap) =====
        lost_packets = 0
        if device and fcnt is not None:
            last_fcnt = device.get("last_fcnt")
            if last_fcnt is not None:
                expected_fcnt = last_fcnt + 1
                if fcnt > expected_fcnt:
                    lost_packets = fcnt - expected_fcnt
                    logger.warning(f"Packet loss detected for {dev_eui}: expected fCnt={expected_fcnt}, got={fcnt}, lost={lost_packets}")
                elif fcnt < last_fcnt:
                    # Counter reset (device reboot) - no loss counted
                    logger.info(f"fCnt reset detected for {dev_eui}: last={last_fcnt}, current={fcnt}")
                    lost_packets = 0
        
        # Create uplink logs for each gateway
        created_logs = []
        for rx_info in rx_info_list:
            raw_gateway_id = rx_info.get("gatewayId", "")
            # Normalize gateway ID to uppercase as well
            gateway_id_raw = raw_gateway_id.upper().strip() if raw_gateway_id else ""
            rssi = rx_info.get("rssi", -100)
            snr = rx_info.get("snr", 0)
            
            # Try to find gateway by dev_eui first, then by id (case-insensitive)
            gateway = await db.gateways.find_one({"dev_eui": gateway_id_raw})
            if not gateway:
                gateway = await db.gateways.find_one({"dev_eui": raw_gateway_id})  # Try original case
            if not gateway:
                gateway = await db.gateways.find_one({"id": gateway_id_raw})
            if not gateway:
                gateway = await db.gateways.find_one({"id": raw_gateway_id})  # Try original case
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
                spreading_factor=spreading_factor,
                fcnt=fcnt,
                frequency=frequency,
                packets_lost=lost_packets
            )
            
            await db.uplinks.insert_one(uplink.model_dump())
            created_logs.append(uplink)
        
        # Update device's SF buffer (FIFO), packet loss, battery and recalculate average
        if device:
            sf_buffer = device.get("sf_buffer", [])
            
            # Add new SF value to buffer
            sf_buffer.append(spreading_factor)
            
            # Keep only last SF_BUFFER_SIZE values (FIFO)
            if len(sf_buffer) > SF_BUFFER_SIZE:
                sf_buffer = sf_buffer[-SF_BUFFER_SIZE:]
            
            # Calculate new average
            sf_average = calculate_sf_average(sf_buffer)
            
            # Build update dict
            update_fields = {
                "last_seen": datetime.now(timezone.utc).isoformat(),
                "last_sf": spreading_factor,
                "sf_buffer": sf_buffer,
                "sf_average": sf_average
            }
            
            # Update fCnt
            if fcnt is not None:
                update_fields["last_fcnt"] = fcnt
            
            # Update packet loss counters
            if lost_packets > 0:
                update_fields["packets_lost"] = device.get("packets_lost", 0) + lost_packets
                update_fields["consecutive_lost"] = device.get("consecutive_lost", 0) + lost_packets
            else:
                # Reset consecutive counter on successful reception
                update_fields["consecutive_lost"] = 0
            
            await db.devices.update_one(
                {"dev_eui": dev_eui},
                {"$set": update_fields}
            )
        
        return {
            "status": "success",
            "message": f"Processed uplink from {dev_eui}",
            "logs_created": len(created_logs),
            "sf_buffer_size": len(device.get("sf_buffer", [])) + 1 if device else 0,
            "fcnt": fcnt,
            "frequency": frequency,
            "packets_lost": lost_packets
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
            "snr": latest_uplink.get("snr") if latest_uplink else None,
            # NOC fields
            "packets_lost": device.get("packets_lost", 0),
            "consecutive_lost": device.get("consecutive_lost", 0),
        })
    
    return heatmap_points

# ==================== NOC ANALYTICS ENDPOINTS ====================

@api_router.get("/alerts")
async def get_alerts():
    """
    Get active NOC alerts:
    - Packet loss: devices with consecutive_lost > 3
    - SF Critical: devices with sf_average > 10.5
    - Offline: devices not seen for > 24 hours
    """
    now = datetime.now(timezone.utc)
    threshold_24h = (now - timedelta(hours=24)).isoformat()
    
    devices = await db.devices.find({}, {"_id": 0}).to_list(10000)
    
    alerts = []
    
    for device in devices:
        # Packet loss alert: consecutive_lost > 3
        consecutive_lost = device.get("consecutive_lost", 0)
        if consecutive_lost > 3:
            alerts.append({
                "type": "packet_loss",
                "severity": "critical" if consecutive_lost > 10 else "warning",
                "dev_eui": device["dev_eui"],
                "device_name": device.get("name", "Unknown"),
                "message": f"{consecutive_lost} pachete consecutive pierdute",
                "value": consecutive_lost,
                "sf_average": device.get("sf_average"),
                "timestamp": device.get("last_seen")
            })
        
        # SF Critical alert: sf_average > 10.5
        sf_average = device.get("sf_average")
        if sf_average is not None and sf_average > 10.5:
            alerts.append({
                "type": "sf_critical",
                "severity": "critical",
                "dev_eui": device["dev_eui"],
                "device_name": device.get("name", "Unknown"),
                "message": f"SF mediu critic: {sf_average}",
                "value": sf_average,
                "sf_average": sf_average,
                "timestamp": device.get("last_seen")
            })
        
        # Offline alert: not seen for > 24 hours
        last_seen = device.get("last_seen")
        if last_seen and last_seen < threshold_24h:
            alerts.append({
                "type": "offline",
                "severity": "warning",
                "dev_eui": device["dev_eui"],
                "device_name": device.get("name", "Unknown"),
                "message": f"Dispozitiv offline de peste 24 ore",
                "value": last_seen,
                "sf_average": device.get("sf_average"),
                "timestamp": last_seen
            })
    
    # Sort by severity (critical first), then by type
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: (severity_order.get(a["severity"], 99), a["type"]))
    
    return {
        "alerts": alerts,
        "total": len(alerts),
        "critical": sum(1 for a in alerts if a["severity"] == "critical"),
        "warning": sum(1 for a in alerts if a["severity"] == "warning")
    }


@api_router.get("/analytics/sf-distribution")
async def get_sf_distribution():
    """
    SF Distribution across the entire network.
    Returns percentage for each SF (7-12).
    Used for Pie/Donut chart.
    """
    pipeline = [
        {"$group": {
            "_id": "$spreading_factor",
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.uplinks.aggregate(pipeline).to_list(20)
    
    total = sum(r["count"] for r in results)
    distribution = []
    
    for r in results:
        sf = r["_id"]
        count = r["count"]
        percentage = round((count / total * 100), 1) if total > 0 else 0
        distribution.append({
            "sf": f"SF{sf}" if sf else "Unknown",
            "sf_value": sf,
            "count": count,
            "percentage": percentage
        })
    
    return {
        "distribution": distribution,
        "total_uplinks": total
    }


@api_router.get("/analytics/top-problematic")
async def get_top_problematic(metric: str = "packet_loss", limit: int = 10):
    """
    Top N nodes with problems.
    Metrics: 'packet_loss' (most lost packets) or 'snr' (lowest average SNR).
    Used for Bar chart.
    """
    if metric == "snr":
        # Aggregate average SNR per device from uplinks
        pipeline = [
            {"$group": {
                "_id": "$dev_eui",
                "device_name": {"$first": "$device_name"},
                "avg_snr": {"$avg": "$snr"},
                "avg_rssi": {"$avg": "$rssi"},
                "uplink_count": {"$sum": 1}
            }},
            {"$sort": {"avg_snr": 1}},  # Worst SNR first
            {"$limit": limit}
        ]
        results = await db.uplinks.aggregate(pipeline).to_list(limit)
        
        nodes = []
        for r in results:
            nodes.append({
                "dev_eui": r["_id"],
                "device_name": r.get("device_name") or r["_id"],
                "value": round(r["avg_snr"], 2),
                "metric_label": "SNR Mediu (dB)",
                "avg_rssi": round(r.get("avg_rssi", 0), 1),
                "uplink_count": r["uplink_count"]
            })
        
        return {"nodes": nodes, "metric": "snr", "label": "Top Noduri cu SNR Scăzut"}
    
    else:
        # packet_loss: get from devices collection
        devices = await db.devices.find(
            {"packets_lost": {"$gt": 0}},
            {"_id": 0}
        ).sort("packets_lost", -1).to_list(limit)
        
        # If no packet loss data, fallback to aggregating from uplinks
        if not devices:
            pipeline = [
                {"$match": {"packets_lost": {"$gt": 0}}},
                {"$group": {
                    "_id": "$dev_eui",
                    "device_name": {"$first": "$device_name"},
                    "total_lost": {"$sum": "$packets_lost"},
                    "uplink_count": {"$sum": 1}
                }},
                {"$sort": {"total_lost": -1}},
                {"$limit": limit}
            ]
            results = await db.uplinks.aggregate(pipeline).to_list(limit)
            
            nodes = []
            for r in results:
                nodes.append({
                    "dev_eui": r["_id"],
                    "device_name": r.get("device_name") or r["_id"],
                    "value": r["total_lost"],
                    "metric_label": "Pachete Pierdute",
                    "uplink_count": r["uplink_count"]
                })
        else:
            nodes = []
            for d in devices:
                nodes.append({
                    "dev_eui": d["dev_eui"],
                    "device_name": d.get("name", d["dev_eui"]),
                    "value": d.get("packets_lost", 0),
                    "metric_label": "Pachete Pierdute",
                    "consecutive_lost": d.get("consecutive_lost", 0)
                })
        
        return {"nodes": nodes, "metric": "packet_loss", "label": "Top Noduri cu Pachete Pierdute"}


@api_router.get("/analytics/rf-quality/{dev_eui}")
async def get_rf_quality(dev_eui: str, days: int = 7):
    """
    RF quality evolution (RSSI and SNR) for a specific device over the last N days.
    Used for Line chart.
    """
    # Normalize DevEUI
    dev_eui = dev_eui.upper().strip()
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    uplinks = await db.uplinks.find(
        {"dev_eui": dev_eui, "timestamp": {"$gte": start_date}},
        {"_id": 0, "rssi": 1, "snr": 1, "spreading_factor": 1, "timestamp": 1, "fcnt": 1}
    ).sort("timestamp", 1).to_list(10000)
    
    # Get device info
    device = await db.devices.find_one({"dev_eui": dev_eui}, {"_id": 0, "name": 1, "dev_eui": 1})
    
    return {
        "dev_eui": dev_eui,
        "device_name": device.get("name") if device else dev_eui,
        "days": days,
        "data_points": len(uplinks),
        "uplinks": uplinks
    }


@api_router.get("/analytics/gateway-load")
async def get_gateway_load(gateway_id: Optional[str] = None, hours: int = 24):
    """
    Gateway traffic load: uplinks per hour over the last N hours.
    Used for Area/Bar chart to monitor duty cycle.
    """
    start_time = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    
    match_stage = {"timestamp": {"$gte": start_time}}
    if gateway_id:
        match_stage["gateway_id"] = gateway_id
    
    # Aggregate uplinks per hour
    pipeline = [
        {"$match": match_stage},
        {"$addFields": {
            "hour_str": {"$substr": ["$timestamp", 0, 13]}  # Extract YYYY-MM-DDTHH
        }},
        {"$group": {
            "_id": {
                "hour": "$hour_str",
                "gateway_id": "$gateway_id",
                "gateway_name": "$gateway_name"
            },
            "count": {"$sum": 1},
            "avg_rssi": {"$avg": "$rssi"},
            "avg_snr": {"$avg": "$snr"}
        }},
        {"$sort": {"_id.hour": 1}}
    ]
    
    results = await db.uplinks.aggregate(pipeline).to_list(1000)
    
    # Format results
    hourly_data = []
    for r in results:
        hourly_data.append({
            "hour": r["_id"]["hour"],
            "gateway_id": r["_id"].get("gateway_id", ""),
            "gateway_name": r["_id"].get("gateway_name", "Unknown"),
            "count": r["count"],
            "avg_rssi": round(r.get("avg_rssi", 0), 1),
            "avg_snr": round(r.get("avg_snr", 0), 1)
        })
    
    # Also get available gateways for dropdown
    gateways = await db.gateways.find({}, {"_id": 0, "id": 1, "name": 1, "dev_eui": 1}).to_list(100)
    
    return {
        "hourly_data": hourly_data,
        "hours": hours,
        "gateway_filter": gateway_id,
        "gateways": gateways
    }


@api_router.get("/analytics/device-list")
async def get_device_list_for_analytics():
    """
    Simple device list for analytics dropdowns.
    """
    devices = await db.devices.find(
        {},
        {"_id": 0, "dev_eui": 1, "name": 1, "last_seen": 1, "last_sf": 1}
    ).to_list(10000)
    
    return devices


@api_router.get("/stats/frequencies")
async def get_frequency_distribution(gateway_id: Optional[str] = None):
    """
    Get frequency distribution (count per frequency) for a specific gateway or all gateways.
    Returns data for Bar Chart (Received / Frequency like ChirpStack).
    """
    match_stage = {}
    if gateway_id:
        match_stage["gateway_id"] = gateway_id
    
    # Only include uplinks that have frequency data
    match_stage["frequency"] = {"$ne": None, "$exists": True}
    
    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": "$frequency",
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.uplinks.aggregate(pipeline).to_list(100)
    
    frequencies = []
    for r in results:
        freq_hz = r["_id"]
        if freq_hz:
            freq_mhz = round(freq_hz / 1_000_000, 1)
            frequencies.append({
                "frequency_hz": freq_hz,
                "frequency_mhz": freq_mhz,
                "label": f"{freq_mhz} MHz",
                "count": r["count"]
            })
    
    return {
        "frequencies": frequencies,
        "gateway_id": gateway_id,
        "total_messages": sum(f["count"] for f in frequencies)
    }


@api_router.delete("/uplinks/unregistered/{dev_eui}")
async def delete_unregistered_uplinks(dev_eui: str):
    """
    Delete/ignore all uplinks from an unregistered device.
    Used from Live Feed to dismiss unregistered device alerts.
    """
    normalized = dev_eui.upper().strip()
    
    # Verify the device is indeed not registered
    existing_device = await db.devices.find_one({"dev_eui": normalized})
    if existing_device:
        raise HTTPException(status_code=400, detail="Device is registered. Use the devices endpoint to manage it.")
    
    result = await db.uplinks.delete_many({"dev_eui": normalized, "device_registered": False})
    
    return {
        "status": "success",
        "message": f"Deleted {result.deleted_count} uplinks from unregistered device {normalized}",
        "deleted_count": result.deleted_count
    }

# ==================== SF RECALCULATION ====================

@api_router.post("/recalculate-sf")
async def recalculate_all_sf():
    """
    Recalculate SF buffers and averages for all devices based on their last 10 uplinks.
    This is useful after fixing SF extraction logic to update historical data.
    """
    try:
        # Get all devices
        devices = await db.devices.find({}, {"_id": 0}).to_list(10000)
        
        updated_count = 0
        devices_with_data = 0
        
        for device in devices:
            dev_eui = device["dev_eui"]
            
            # Get last 10 uplinks for this device, sorted by timestamp desc
            uplinks = await db.uplinks.find(
                {"dev_eui": dev_eui},
                {"_id": 0, "spreading_factor": 1, "timestamp": 1}
            ).sort("timestamp", -1).limit(SF_BUFFER_SIZE).to_list(SF_BUFFER_SIZE)
            
            if uplinks:
                # Build SF buffer from uplinks (reverse to get chronological order)
                sf_buffer = [u["spreading_factor"] for u in reversed(uplinks) if u.get("spreading_factor")]
                
                if sf_buffer:
                    sf_average = calculate_sf_average(sf_buffer)
                    last_sf = sf_buffer[-1] if sf_buffer else None
                    
                    await db.devices.update_one(
                        {"dev_eui": dev_eui},
                        {"$set": {
                            "sf_buffer": sf_buffer,
                            "sf_average": sf_average,
                            "last_sf": last_sf
                        }}
                    )
                    devices_with_data += 1
                    updated_count += 1
            else:
                # No uplinks - reset to empty
                await db.devices.update_one(
                    {"dev_eui": dev_eui},
                    {"$set": {
                        "sf_buffer": [],
                        "sf_average": None,
                        "last_sf": None
                    }}
                )
                updated_count += 1
        
        logger.info(f"Recalculated SF for {updated_count} devices, {devices_with_data} have uplink data")
        
        return {
            "status": "success",
            "message": f"SF recalculated for {updated_count} devices",
            "devices_with_data": devices_with_data,
            "devices_without_data": updated_count - devices_with_data
        }
        
    except Exception as e:
        logger.error(f"Error recalculating SF: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/reset-sf-history")
async def reset_sf_history():
    """
    Reset all SF buffers and averages to empty/null.
    Use this to start fresh with correct SF values from new webhooks.
    """
    try:
        result = await db.devices.update_many(
            {},
            {"$set": {
                "sf_buffer": [],
                "sf_average": None,
                "last_sf": None,
                "last_seen": None
            }}
        )
        
        logger.info(f"Reset SF history for {result.modified_count} devices")
        
        return {
            "status": "success",
            "message": f"SF history reset for {result.modified_count} devices",
            "devices_reset": result.modified_count
        }
        
    except Exception as e:
        logger.error(f"Error resetting SF history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
