import requests
import sys
import json
from datetime import datetime, timezone
import time

class LoRaWANAPITester:
    def __init__(self, base_url="https://verifica-tool.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f" (Expected: {expected_status})"
                if response.text:
                    details += f" Response: {response.text[:200]}"
            
            self.log_test(name, success, details)
            return success, response.json() if success and response.text else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_stats_endpoint(self):
        """Test stats endpoint"""
        success, response = self.run_test("Stats API", "GET", "stats", 200)
        if success:
            required_fields = ['total_gateways', 'total_devices', 'total_uplinks', 'uplinks_today', 'sf_distribution']
            for field in required_fields:
                if field not in response:
                    self.log_test(f"Stats - {field} field", False, f"Missing field: {field}")
                    return False
            self.log_test("Stats - All fields present", True)
        return success

    def test_gateways_crud(self):
        """Test gateway CRUD operations with V1.1 DevEUI features"""
        # Get initial gateways
        success, initial_gateways = self.run_test("Get Gateways", "GET", "gateways", 200)
        if not success:
            return False

        # Check if gateways have DevEUI field
        if len(initial_gateways) > 0:
            gateway = initial_gateways[0]
            if 'dev_eui' in gateway:
                self.log_test("Gateway - DevEUI field present", True)
            else:
                self.log_test("Gateway - DevEUI field present", False, "Missing dev_eui field")

        # Create a test gateway with DevEUI
        test_gateway = {
            "dev_eui": "AA00BB11CC22DD44",
            "name": "Test Gateway API",
            "latitude": 44.4500,
            "longitude": 26.1100,
            "status": "active"
        }
        
        success, created_gateway = self.run_test("Create Gateway with DevEUI", "POST", "gateways", 200, test_gateway)
        if not success:
            return False

        gateway_id = created_gateway.get('id')
        if not gateway_id:
            self.log_test("Gateway Creation - ID", False, "No ID returned")
            return False

        # Check if created gateway has DevEUI
        if 'dev_eui' in created_gateway and created_gateway['dev_eui'] == "AA00BB11CC22DD44":
            self.log_test("Gateway Creation - DevEUI stored", True)
        else:
            self.log_test("Gateway Creation - DevEUI stored", False, "DevEUI not stored correctly")

        # Get specific gateway
        success, _ = self.run_test("Get Gateway by ID", "GET", f"gateways/{gateway_id}", 200)
        if not success:
            return False

        # Update gateway
        updated_data = {
            "dev_eui": "AA00BB11CC22DD55",
            "name": "Updated Test Gateway",
            "latitude": 44.4600,
            "longitude": 26.1200,
            "status": "active"
        }
        success, _ = self.run_test("Update Gateway", "PUT", f"gateways/{gateway_id}", 200, updated_data)
        if not success:
            return False

        # Test duplicate DevEUI (should fail)
        duplicate_gateway = {
            "dev_eui": "AA00BB11CC22DD55",  # Same DevEUI as updated
            "name": "Duplicate Gateway",
            "latitude": 44.4700,
            "longitude": 26.1300,
            "status": "active"
        }
        success, _ = self.run_test("Create Duplicate Gateway DevEUI (should fail)", "POST", "gateways", 400, duplicate_gateway)
        if not success:
            self.log_test("Duplicate Gateway DevEUI Prevention", False, "Should have returned 400 for duplicate DevEUI")

        # Delete gateway
        success, _ = self.run_test("Delete Gateway", "DELETE", f"gateways/{gateway_id}", 200)
        return success

    def test_devices_crud(self):
        """Test device CRUD operations with V1.1 SF buffer features"""
        # Get initial devices
        success, initial_devices = self.run_test("Get Devices", "GET", "devices", 200)
        if not success:
            return False

        # Check if devices have SF buffer fields
        if len(initial_devices) > 0:
            device = initial_devices[0]
            sf_fields = ['sf_buffer', 'sf_average']
            for field in sf_fields:
                if field in device:
                    self.log_test(f"Device - {field} field present", True)
                else:
                    self.log_test(f"Device - {field} field present", False, f"Missing {field}")

        # Create a test device
        test_device = {
            "dev_eui": "AABBCCDDEEFF0099",
            "name": "Test Device API",
            "latitude": 44.4300,
            "longitude": 26.1050
        }
        
        success, created_device = self.run_test("Create Device", "POST", "devices", 200, test_device)
        if not success:
            return False

        device_id = created_device.get('id')
        if not device_id:
            self.log_test("Device Creation - ID", False, "No ID returned")
            return False

        # Check if created device has SF buffer initialized
        if 'sf_buffer' in created_device:
            if isinstance(created_device['sf_buffer'], list):
                self.log_test("Device Creation - SF buffer initialized", True)
            else:
                self.log_test("Device Creation - SF buffer initialized", False, "SF buffer not a list")
        else:
            self.log_test("Device Creation - SF buffer field", False, "Missing sf_buffer field")

        # Get specific device
        success, _ = self.run_test("Get Device by ID", "GET", f"devices/{device_id}", 200)
        if not success:
            return False

        # Update device
        updated_data = {
            "dev_eui": "AABBCCDDEEFF0099",  # Same DevEUI
            "name": "Updated Test Device",
            "latitude": 44.4400,
            "longitude": 26.1150
        }
        success, _ = self.run_test("Update Device", "PUT", f"devices/{device_id}", 200, updated_data)
        if not success:
            return False

        # Test duplicate DevEUI (should fail)
        duplicate_device = {
            "dev_eui": "AABBCCDDEEFF0099",  # Same DevEUI
            "name": "Duplicate Device",
            "latitude": 44.4500,
            "longitude": 26.1250
        }
        success, _ = self.run_test("Create Duplicate Device (should fail)", "POST", "devices", 400, duplicate_device)
        if not success:
            self.log_test("Duplicate DevEUI Prevention", False, "Should have returned 400 for duplicate DevEUI")

        # Delete device
        success, _ = self.run_test("Delete Device", "DELETE", f"devices/{device_id}", 200)
        return success

    def test_uplinks_endpoint(self):
        """Test uplinks endpoint"""
        success, uplinks = self.run_test("Get Uplinks", "GET", "uplinks", 200)
        if success and isinstance(uplinks, list):
            self.log_test("Uplinks - Response is list", True)
            if len(uplinks) > 0:
                uplink = uplinks[0]
                required_fields = ['dev_eui', 'rssi', 'snr', 'spreading_factor', 'timestamp']
                for field in required_fields:
                    if field not in uplink:
                        self.log_test(f"Uplink - {field} field", False, f"Missing field: {field}")
                        return False
                self.log_test("Uplinks - All fields present", True)
        return success

    def test_heatmap_endpoint(self):
        """Test heatmap endpoint with V1.1 SF buffer features"""
        success, heatmap_data = self.run_test("Get Heatmap Data", "GET", "heatmap", 200)
        if success and isinstance(heatmap_data, list):
            self.log_test("Heatmap - Response is list", True)
            if len(heatmap_data) > 0:
                point = heatmap_data[0]
                required_fields = ['dev_eui', 'name', 'latitude', 'longitude', 'sf_average', 'sf_buffer_size']
                for field in required_fields:
                    if field not in point:
                        self.log_test(f"Heatmap - {field} field", False, f"Missing field: {field}")
                        return False
                self.log_test("Heatmap - All V1.1 fields present", True)
                
                # Test SF buffer specific fields
                if 'sf_buffer' in point and isinstance(point['sf_buffer'], list):
                    self.log_test("Heatmap - SF buffer is list", True)
                    if len(point['sf_buffer']) <= 10:
                        self.log_test("Heatmap - SF buffer size <= 10", True)
                    else:
                        self.log_test("Heatmap - SF buffer size <= 10", False, f"Buffer size: {len(point['sf_buffer'])}")
                else:
                    self.log_test("Heatmap - SF buffer field", False, "Missing or invalid sf_buffer")
        return success

    def test_chirpstack_webhook(self):
        """Test ChirpStack webhook endpoint with V1.1 SF buffer updates"""
        # First get a device to use in webhook test
        success, devices = self.run_test("Get Devices for Webhook", "GET", "devices", 200)
        if not success or not devices:
            self.log_test("Webhook Test - No devices", False, "Need devices for webhook test")
            return False

        device = devices[0]
        initial_buffer_size = len(device.get('sf_buffer', []))
        
        # Test webhook payload
        webhook_payload = {
            "devEui": device['dev_eui'],
            "txInfo": {
                "dr": 5,  # DataRate 5 = SF7
                "frequency": 868100000
            },
            "rxInfo": [
                {
                    "gatewayId": "test-gateway-webhook",
                    "rssi": -75,
                    "snr": 8.5
                }
            ]
        }
        
        success, response = self.run_test("ChirpStack Webhook", "POST", "chirpstack/webhook", 200, webhook_payload)
        if success:
            if 'status' in response and response['status'] == 'success':
                self.log_test("Webhook - Success status", True)
            else:
                self.log_test("Webhook - Success status", False, "Missing success status")
            
            # Check if SF buffer size is reported
            if 'sf_buffer_size' in response:
                new_buffer_size = response['sf_buffer_size']
                if new_buffer_size > initial_buffer_size:
                    self.log_test("Webhook - SF buffer updated", True)
                else:
                    self.log_test("Webhook - SF buffer updated", False, f"Buffer size didn't increase: {initial_buffer_size} -> {new_buffer_size}")
            else:
                self.log_test("Webhook - SF buffer size reported", False, "Missing sf_buffer_size in response")
        
        # Verify device was updated by getting it again
        time.sleep(1)  # Small delay to ensure update is processed
        success, updated_device = self.run_test("Get Updated Device", "GET", f"devices/{device['id']}", 200)
        if success:
            if 'sf_buffer' in updated_device and len(updated_device['sf_buffer']) > initial_buffer_size:
                self.log_test("Webhook - Device SF buffer updated", True)
            else:
                self.log_test("Webhook - Device SF buffer updated", False, "Device SF buffer not updated")
            
            if 'sf_average' in updated_device and updated_device['sf_average'] is not None:
                self.log_test("Webhook - SF average calculated", True)
            else:
                self.log_test("Webhook - SF average calculated", False, "SF average not calculated")
        
        return success

    def test_csv_import(self):
        """Test CSV import functionality"""
        # Create a test CSV content
        csv_content = "DevEUI,Name,Latitude,Longitude\nAABBCCDDEEFF1111,CSV Test Device 1,44.4400,26.1100\nAABBCCDDEEFF2222,CSV Test Device 2,44.4500,26.1200"
        
        # Create a temporary file-like object
        import io
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        
        # Test CSV import endpoint
        files = {'file': ('test_devices.csv', csv_file, 'text/csv')}
        
        try:
            import requests
            response = requests.post(f"{self.api_url}/devices/import-csv", files=files, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                result = response.json()
                if 'imported' in result and result['imported'] > 0:
                    self.log_test("CSV Import - Devices imported", True, f"Imported: {result['imported']}")
                else:
                    self.log_test("CSV Import - Devices imported", False, "No devices imported")
            else:
                details += f" Response: {response.text[:200]}"
            
            self.log_test("CSV Import", success, details)
            return success
            
        except Exception as e:
            self.log_test("CSV Import", False, f"Exception: {str(e)}")
            return False

    def test_seed_endpoint(self):
        """Test seed endpoint"""
        success, response = self.run_test("Seed Demo Data", "POST", "seed", 200)
        if success:
            if 'message' in response:
                self.log_test("Seed - Response message", True)
            else:
                self.log_test("Seed - Response message", False, "Missing message field")
        return success

    def test_recalculate_sf_endpoint(self):
        """Test SF recalculation endpoint"""
        success, response = self.run_test("Recalculate SF", "POST", "recalculate-sf", 200)
        if success:
            required_fields = ['status', 'message', 'devices_with_data', 'devices_without_data']
            for field in required_fields:
                if field not in response:
                    self.log_test(f"Recalculate SF - {field} field", False, f"Missing field: {field}")
                    return False
            
            if response['status'] == 'success':
                self.log_test("Recalculate SF - Success status", True)
            else:
                self.log_test("Recalculate SF - Success status", False, f"Status: {response['status']}")
            
            self.log_test("Recalculate SF - All fields present", True)
        return success

    def test_reset_sf_history_endpoint(self):
        """Test SF history reset endpoint"""
        success, response = self.run_test("Reset SF History", "POST", "reset-sf-history", 200)
        if success:
            required_fields = ['status', 'message', 'devices_reset']
            for field in required_fields:
                if field not in response:
                    self.log_test(f"Reset SF History - {field} field", False, f"Missing field: {field}")
                    return False
            
            if response['status'] == 'success':
                self.log_test("Reset SF History - Success status", True)
            else:
                self.log_test("Reset SF History - Success status", False, f"Status: {response['status']}")
            
            self.log_test("Reset SF History - All fields present", True)
        return success

    def test_noc_alerts_endpoint(self):
        """Test NOC alerts endpoint"""
        success, response = self.run_test("NOC Alerts", "GET", "alerts", 200)
        if success:
            required_fields = ['alerts', 'total', 'critical', 'warning']
            for field in required_fields:
                if field not in response:
                    self.log_test(f"NOC Alerts - {field} field", False, f"Missing field: {field}")
                    return False
            
            if isinstance(response['alerts'], list):
                self.log_test("NOC Alerts - Alerts is list", True)
            else:
                self.log_test("NOC Alerts - Alerts is list", False, "Alerts field is not a list")
            
            # Check alert structure if alerts exist
            if len(response['alerts']) > 0:
                alert = response['alerts'][0]
                alert_fields = ['type', 'severity', 'dev_eui', 'device_name', 'message']
                for field in alert_fields:
                    if field not in alert:
                        self.log_test(f"NOC Alerts - Alert {field} field", False, f"Missing field: {field}")
                        return False
                self.log_test("NOC Alerts - Alert structure valid", True)
            
            self.log_test("NOC Alerts - All fields present", True)
        return success

    def test_sf_distribution_endpoint(self):
        """Test SF distribution analytics endpoint"""
        success, response = self.run_test("SF Distribution Analytics", "GET", "analytics/sf-distribution", 200)
        if success:
            required_fields = ['distribution', 'total_uplinks']
            for field in required_fields:
                if field not in response:
                    self.log_test(f"SF Distribution - {field} field", False, f"Missing field: {field}")
                    return False
            
            if isinstance(response['distribution'], list):
                self.log_test("SF Distribution - Distribution is list", True)
            else:
                self.log_test("SF Distribution - Distribution is list", False, "Distribution field is not a list")
            
            # Check distribution structure if data exists
            if len(response['distribution']) > 0:
                dist = response['distribution'][0]
                dist_fields = ['sf', 'count', 'percentage']
                for field in dist_fields:
                    if field not in dist:
                        self.log_test(f"SF Distribution - {field} field", False, f"Missing field: {field}")
                        return False
                self.log_test("SF Distribution - Distribution structure valid", True)
            
            self.log_test("SF Distribution - All fields present", True)
        return success

    def test_top_problematic_endpoint(self):
        """Test top problematic nodes endpoint"""
        # Test packet_loss metric
        success, response = self.run_test("Top Problematic (Packet Loss)", "GET", "analytics/top-problematic?metric=packet_loss", 200)
        if success:
            required_fields = ['nodes', 'metric', 'label']
            for field in required_fields:
                if field not in response:
                    self.log_test(f"Top Problematic PL - {field} field", False, f"Missing field: {field}")
                    return False
            
            if isinstance(response['nodes'], list):
                self.log_test("Top Problematic PL - Nodes is list", True)
            else:
                self.log_test("Top Problematic PL - Nodes is list", False, "Nodes field is not a list")
        
        # Test SNR metric
        success2, response2 = self.run_test("Top Problematic (SNR)", "GET", "analytics/top-problematic?metric=snr", 200)
        if success2:
            if isinstance(response2['nodes'], list):
                self.log_test("Top Problematic SNR - Nodes is list", True)
            else:
                self.log_test("Top Problematic SNR - Nodes is list", False, "Nodes field is not a list")
        
        return success and success2

    def test_rf_quality_endpoint(self):
        """Test RF quality endpoint for specific device"""
        # First get a device to test with
        success, devices = self.run_test("Get Devices for RF Quality", "GET", "devices", 200)
        if not success or not devices:
            self.log_test("RF Quality Test - No devices", False, "Need devices for RF quality test")
            return False
        
        dev_eui = devices[0]['dev_eui']
        success, response = self.run_test("RF Quality Analytics", "GET", f"analytics/rf-quality/{dev_eui}?days=7", 200)
        if success:
            required_fields = ['dev_eui', 'device_name', 'uplinks']
            for field in required_fields:
                if field not in response:
                    self.log_test(f"RF Quality - {field} field", False, f"Missing field: {field}")
                    return False
            
            if isinstance(response['uplinks'], list):
                self.log_test("RF Quality - Uplinks is list", True)
            else:
                self.log_test("RF Quality - Uplinks is list", False, "Uplinks field is not a list")
            
            self.log_test("RF Quality - All fields present", True)
        return success

    def test_gateway_load_endpoint(self):
        """Test gateway load analytics endpoint"""
        success, response = self.run_test("Gateway Load Analytics", "GET", "analytics/gateway-load", 200)
        if success:
            required_fields = ['hourly_data', 'gateways']
            for field in required_fields:
                if field not in response:
                    self.log_test(f"Gateway Load - {field} field", False, f"Missing field: {field}")
                    return False
            
            if isinstance(response['hourly_data'], list):
                self.log_test("Gateway Load - Hourly data is list", True)
            else:
                self.log_test("Gateway Load - Hourly data is list", False, "Hourly data field is not a list")
            
            if isinstance(response['gateways'], list):
                self.log_test("Gateway Load - Gateways is list", True)
            else:
                self.log_test("Gateway Load - Gateways is list", False, "Gateways field is not a list")
            
            self.log_test("Gateway Load - All fields present", True)
        return success

    def test_device_list_endpoint(self):
        """Test device list for analytics endpoint"""
        success, response = self.run_test("Device List Analytics", "GET", "analytics/device-list", 200)
        if success:
            if isinstance(response, list):
                self.log_test("Device List - Response is list", True)
                
                # Check device structure if devices exist
                if len(response) > 0:
                    device = response[0]
                    required_fields = ['dev_eui', 'name']
                    for field in required_fields:
                        if field not in device:
                            self.log_test(f"Device List - {field} field", False, f"Missing field: {field}")
                            return False
                    self.log_test("Device List - Device structure valid", True)
            else:
                self.log_test("Device List - Response is list", False, "Response is not a list")
        return success

    def test_webhook_fcnt_battery(self):
        """Test webhook with fCnt and battery processing"""
        # First ensure we have a device to test with
        success, devices = self.run_test("Get Devices for Webhook fCnt Test", "GET", "devices", 200)
        if not success or not devices:
            self.log_test("Webhook fCnt Test - No devices", False, "Need devices for webhook test")
            return False

        dev_eui = "0011223344556601"  # Use specific device from review request
        
        # Test webhook payload with fCnt and battery
        webhook_payload = {
            "devEui": dev_eui,
            "deviceName": "Sensor Piata Universitatii",
            "spreadingFactor": 8,
            "fCnt": 100,
            "object": {"battery": 85.5},
            "rxInfo": [{"gatewayId": "AA00BB11CC22DD33", "rssi": -70, "snr": 9.0}]
        }
        
        success, response = self.run_test("Webhook with fCnt & Battery", "POST", "chirpstack/webhook", 200, webhook_payload)
        if success:
            # Check response contains fCnt and battery info
            if 'fcnt' in response and response['fcnt'] == 100:
                self.log_test("Webhook fCnt - Extracted correctly", True)
            else:
                self.log_test("Webhook fCnt - Extracted correctly", False, f"fCnt not extracted: {response.get('fcnt')}")
            
            if 'battery_level' in response and response['battery_level'] == 85.5:
                self.log_test("Webhook Battery - Extracted correctly", True)
            else:
                self.log_test("Webhook Battery - Extracted correctly", False, f"Battery not extracted: {response.get('battery_level')}")
        
        # Verify device has updated fCnt and battery
        time.sleep(1)  # Small delay
        success2, updated_devices = self.run_test("Get Devices after fCnt Update", "GET", "devices", 200)
        if success2:
            # Find our test device
            test_device = None
            for device in updated_devices:
                if device['dev_eui'] == dev_eui:
                    test_device = device
                    break
            
            if test_device:
                if test_device.get('last_fcnt') == 100:
                    self.log_test("Device fCnt - Updated correctly", True)
                else:
                    self.log_test("Device fCnt - Updated correctly", False, f"Device fCnt: {test_device.get('last_fcnt')}")
                
                if test_device.get('battery_level') == 85.5:
                    self.log_test("Device Battery - Updated correctly", True)
                else:
                    self.log_test("Device Battery - Updated correctly", False, f"Device battery: {test_device.get('battery_level')}")
            else:
                self.log_test("Device fCnt/Battery Update", False, f"Device {dev_eui} not found")
        
        return success

    def test_packet_loss_detection(self):
        """Test packet loss detection with fCnt gap"""
        dev_eui = "0011223344556601"  # Use same device as previous test
        
        # Send webhook with gap in fCnt (100 -> 105, gap of 4 packets)
        webhook_payload = {
            "devEui": dev_eui,
            "spreadingFactor": 7,
            "fCnt": 105,
            "object": {"battery": 82.0},
            "rxInfo": [{"gatewayId": "AA00BB11CC22DD33", "rssi": -72, "snr": 8.5}]
        }
        
        success, response = self.run_test("Webhook Packet Loss Detection", "POST", "chirpstack/webhook", 200, webhook_payload)
        if success:
            if 'packets_lost' in response and response['packets_lost'] == 4:
                self.log_test("Packet Loss - Detected correctly", True)
            else:
                self.log_test("Packet Loss - Detected correctly", False, f"Expected 4 lost packets, got: {response.get('packets_lost')}")
        
        # Verify device has updated packet loss counters
        time.sleep(1)  # Small delay
        success2, updated_devices = self.run_test("Get Devices after Packet Loss", "GET", "devices", 200)
        if success2:
            # Find our test device
            test_device = None
            for device in updated_devices:
                if device['dev_eui'] == dev_eui:
                    test_device = device
                    break
            
            if test_device:
                if test_device.get('packets_lost', 0) >= 4:
                    self.log_test("Device Packets Lost - Updated correctly", True)
                else:
                    self.log_test("Device Packets Lost - Updated correctly", False, f"Device packets_lost: {test_device.get('packets_lost')}")
                
                if test_device.get('consecutive_lost', 0) == 4:
                    self.log_test("Device Consecutive Lost - Updated correctly", True)
                else:
                    self.log_test("Device Consecutive Lost - Updated correctly", False, f"Device consecutive_lost: {test_device.get('consecutive_lost')}")
            else:
                self.log_test("Device Packet Loss Update", False, f"Device {dev_eui} not found")
        
        return success

    def test_heatmap_noc_fields(self):
        """Test heatmap includes NOC fields (battery_level, packets_lost, consecutive_lost)"""
        success, heatmap_data = self.run_test("Heatmap NOC Fields", "GET", "heatmap", 200)
        if success and isinstance(heatmap_data, list):
            if len(heatmap_data) > 0:
                point = heatmap_data[0]
                noc_fields = ['battery_level', 'packets_lost', 'consecutive_lost']
                for field in noc_fields:
                    if field in point:
                        self.log_test(f"Heatmap NOC - {field} field present", True)
                    else:
                        self.log_test(f"Heatmap NOC - {field} field present", False, f"Missing NOC field: {field}")
                        success = False
                
                if success:
                    self.log_test("Heatmap NOC - All NOC fields present", True)
            else:
                self.log_test("Heatmap NOC Fields", False, "No heatmap data to verify NOC fields")
                success = False
        return success

    def test_webhook_frequency_v2(self):
        """Test updated webhook with frequency extraction (no battery)"""
        # Test webhook payload with frequency in txInfo
        webhook_payload = {
            "devEui": "0011223344556601",
            "spreadingFactor": 8,
            "fCnt": 500,
            "txInfo": {"frequency": 868100000},
            "rxInfo": [{"gatewayId": "AA00BB11CC22DD33", "rssi": -80, "snr": 7.0}]
        }
        
        success, response = self.run_test("Webhook with Frequency (v2)", "POST", "chirpstack/webhook", 200, webhook_payload)
        if success:
            # Check response contains frequency info
            if 'frequency' in response and response['frequency'] == 868100000:
                self.log_test("Webhook Frequency - Extracted correctly", True)
            else:
                self.log_test("Webhook Frequency - Extracted correctly", False, f"Frequency not extracted: {response.get('frequency')}")
            
            # Verify NO battery_level in response (removed feature)
            if 'battery_level' not in response:
                self.log_test("Webhook - No battery field (correct)", True)
            else:
                self.log_test("Webhook - No battery field (correct)", False, f"Battery field should be removed: {response.get('battery_level')}")
        
        return success

    def test_frequency_distribution_endpoint(self):
        """Test new frequency distribution endpoint"""
        success, response = self.run_test("Frequency Distribution", "GET", "stats/frequencies?gateway_id=AA00BB11CC22DD33", 200)
        if success:
            required_fields = ['frequencies', 'gateway_id', 'total_messages']
            for field in required_fields:
                if field not in response:
                    self.log_test(f"Frequency Distribution - {field} field", False, f"Missing field: {field}")
                    return False
            
            if isinstance(response['frequencies'], list):
                self.log_test("Frequency Distribution - Frequencies is list", True)
                
                # Check frequency structure if data exists
                if len(response['frequencies']) > 0:
                    freq = response['frequencies'][0]
                    freq_fields = ['frequency_hz', 'frequency_mhz', 'label', 'count']
                    for field in freq_fields:
                        if field not in freq:
                            self.log_test(f"Frequency Distribution - {field} field", False, f"Missing frequency field: {field}")
                            return False
                    
                    # Verify format is correct (e.g. "868.1 MHz")
                    if 'label' in freq and 'MHz' in freq['label']:
                        self.log_test("Frequency Distribution - Label format correct", True)
                    else:
                        self.log_test("Frequency Distribution - Label format correct", False, f"Label format incorrect: {freq.get('label')}")
                    
                    self.log_test("Frequency Distribution - Structure valid", True)
            else:
                self.log_test("Frequency Distribution - Frequencies is list", False, "Frequencies field is not a list")
            
            self.log_test("Frequency Distribution - All fields present", True)
        return success

    def test_alerts_no_battery(self):
        """Test alerts endpoint does NOT contain battery alerts"""
        success, response = self.run_test("Alerts (No Battery)", "GET", "alerts", 200)
        if success:
            required_fields = ['alerts', 'total', 'critical', 'warning']
            for field in required_fields:
                if field not in response:
                    self.log_test(f"Alerts No Battery - {field} field", False, f"Missing field: {field}")
                    return False
            
            # Check that NO alerts have type "low_battery" 
            has_battery_alerts = False
            valid_alert_types = ["packet_loss", "sf_critical", "offline"]
            
            for alert in response['alerts']:
                if alert.get('type') == 'low_battery':
                    has_battery_alerts = True
                    break
            
            if not has_battery_alerts:
                self.log_test("Alerts No Battery - No battery alerts (correct)", True)
            else:
                self.log_test("Alerts No Battery - No battery alerts (correct)", False, "Found low_battery alert type")
            
            # Check for expected alert types that exist in the data
            alert_types_found = [alert.get('type') for alert in response['alerts']]
            unique_types = list(set(alert_types_found))
            
            # Verify only valid alert types are present
            invalid_types = [t for t in unique_types if t not in valid_alert_types]
            if not invalid_types:
                self.log_test("Alerts - Only valid alert types present", True)
            else:
                self.log_test("Alerts - Only valid alert types present", False, f"Invalid types found: {invalid_types}")
            
            # Report what alert types are actually present
            if unique_types:
                self.log_test(f"Alerts - Alert types found: {unique_types}", True)
            else:
                self.log_test("Alerts - No alerts found (normal)", True)
            
            self.log_test("Alerts No Battery - Structure valid", True)
        return success

    def test_delete_unregistered_uplinks(self):
        """Test delete unregistered device uplinks endpoint"""
        # First send a webhook from an unregistered device
        unregistered_payload = {
            "devEui": "UNREGISTERED999",
            "spreadingFactor": 7,
            "rxInfo": [{"gatewayId": "AA00BB11CC22DD33", "rssi": -90, "snr": 5.0}]
        }
        
        success1, response1 = self.run_test("Webhook Unregistered Device", "POST", "chirpstack/webhook", 200, unregistered_payload)
        if not success1:
            return False
        
        # Small delay to ensure webhook is processed
        time.sleep(1)
        
        # Now delete the unregistered uplinks
        success, response = self.run_test("Delete Unregistered Uplinks", "DELETE", "uplinks/unregistered/UNREGISTERED999", 200)
        if success:
            required_fields = ['status', 'message', 'deleted_count']
            for field in required_fields:
                if field not in response:
                    self.log_test(f"Delete Unregistered - {field} field", False, f"Missing field: {field}")
                    return False
            
            if response['status'] == 'success':
                self.log_test("Delete Unregistered - Success status", True)
            else:
                self.log_test("Delete Unregistered - Success status", False, f"Status: {response['status']}")
            
            if response['deleted_count'] >= 1:
                self.log_test("Delete Unregistered - Uplinks deleted", True)
            else:
                self.log_test("Delete Unregistered - Uplinks deleted", False, f"Deleted count: {response['deleted_count']}")
        
        return success

    def test_heatmap_no_battery_field(self):
        """Test heatmap does NOT include battery_level field"""
        success, heatmap_data = self.run_test("Heatmap No Battery Field", "GET", "heatmap", 200)
        if success and isinstance(heatmap_data, list):
            if len(heatmap_data) > 0:
                point = heatmap_data[0]
                
                # Check that battery_level field is NOT present
                if 'battery_level' not in point:
                    self.log_test("Heatmap - No battery_level field (correct)", True)
                else:
                    self.log_test("Heatmap - No battery_level field (correct)", False, f"Battery level field should be removed: {point.get('battery_level')}")
                
                # Verify other NOC fields are still present
                expected_noc_fields = ['packets_lost', 'consecutive_lost']
                for field in expected_noc_fields:
                    if field in point:
                        self.log_test(f"Heatmap - {field} field present", True)
                    else:
                        self.log_test(f"Heatmap - {field} field present", False, f"Missing NOC field: {field}")
            else:
                self.log_test("Heatmap No Battery", False, "No heatmap data to verify")
                success = False
        return success

    def run_noc_update_tests(self):
        """Run tests for NEW/UPDATED NOC endpoints"""
        print("🔄 Testing NOC Endpoint Updates...")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)

        # Test updated webhook with frequency (no battery)
        self.test_webhook_frequency_v2()
        
        # Test new frequency distribution endpoint
        self.test_frequency_distribution_endpoint()
        
        # Test updated alerts (no battery alerts)
        self.test_alerts_no_battery()
        
        # Test delete unregistered device uplinks
        self.test_delete_unregistered_uplinks()
        
        # Test recalculate SF still works
        self.test_recalculate_sf_endpoint()
        
        # Test heatmap does not include battery_level
        self.test_heatmap_no_battery_field()

        # Print summary
        print("=" * 50)
        print(f"📊 NOC Update Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All NOC update tests passed!")
            return 0
        else:
            print("❌ Some NOC update tests failed!")
            return 1

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting LoRaWAN API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)

        # Test basic endpoints
        self.test_root_endpoint()
        self.test_stats_endpoint()
        
        # Test CRUD operations
        self.test_gateways_crud()
        self.test_devices_crud()
        
        # Test data endpoints
        self.test_uplinks_endpoint()
        self.test_heatmap_endpoint()
        
        # Test webhook
        self.test_chirpstack_webhook()
        
        # Test CSV import
        self.test_csv_import()
        
        # Test seed
        self.test_seed_endpoint()
        
        # Test SF management endpoints
        self.test_recalculate_sf_endpoint()
        self.test_reset_sf_history_endpoint()

        # Test NOC Analytics Endpoints
        print("\n🔍 Testing NOC Analytics Endpoints...")
        self.test_noc_alerts_endpoint()
        self.test_sf_distribution_endpoint()
        self.test_top_problematic_endpoint()
        self.test_rf_quality_endpoint()
        self.test_gateway_load_endpoint()
        self.test_device_list_endpoint()
        
        # Test enhanced webhook with NOC features
        print("\n🔋 Testing Enhanced Webhook with NOC Features...")
        self.test_webhook_fcnt_battery()
        self.test_packet_loss_detection()
        self.test_heatmap_noc_fields()

        # Print summary
        print("=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed!")
            return 1

def main():
    tester = LoRaWANAPITester()
    # Run only the NOC update tests as requested in review
    return tester.run_noc_update_tests()

def run_all_tests():
    """Function to run all tests if needed"""
    tester = LoRaWANAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())