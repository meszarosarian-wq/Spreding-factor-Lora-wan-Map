import requests
import sys
import json
from datetime import datetime, timezone
import time

class LoRaWANAPITester:
    def __init__(self, base_url="https://sf-coverage-map.preview.emergentagent.com"):
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
        
        # Test seed
        self.test_seed_endpoint()

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
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())