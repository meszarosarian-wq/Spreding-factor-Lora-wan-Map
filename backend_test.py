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
        """Test gateway CRUD operations"""
        # Get initial gateways
        success, initial_gateways = self.run_test("Get Gateways", "GET", "gateways", 200)
        if not success:
            return False

        # Create a test gateway
        test_gateway = {
            "name": "Test Gateway API",
            "latitude": 44.4500,
            "longitude": 26.1100,
            "status": "active"
        }
        
        success, created_gateway = self.run_test("Create Gateway", "POST", "gateways", 200, test_gateway)
        if not success:
            return False

        gateway_id = created_gateway.get('id')
        if not gateway_id:
            self.log_test("Gateway Creation - ID", False, "No ID returned")
            return False

        # Get specific gateway
        success, _ = self.run_test("Get Gateway by ID", "GET", f"gateways/{gateway_id}", 200)
        if not success:
            return False

        # Update gateway
        updated_data = {
            "name": "Updated Test Gateway",
            "latitude": 44.4600,
            "longitude": 26.1200,
            "status": "active"
        }
        success, _ = self.run_test("Update Gateway", "PUT", f"gateways/{gateway_id}", 200, updated_data)
        if not success:
            return False

        # Delete gateway
        success, _ = self.run_test("Delete Gateway", "DELETE", f"gateways/{gateway_id}", 200)
        return success

    def test_devices_crud(self):
        """Test device CRUD operations"""
        # Get initial devices
        success, initial_devices = self.run_test("Get Devices", "GET", "devices", 200)
        if not success:
            return False

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
        """Test ChirpStack webhook endpoint"""
        # First get a device to use in webhook test
        success, devices = self.run_test("Get Devices for Webhook", "GET", "devices", 200)
        if not success or not devices:
            self.log_test("Webhook Test - No devices", False, "Need devices for webhook test")
            return False

        device = devices[0]
        
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
        return success

    def test_seed_endpoint(self):
        """Test seed endpoint"""
        success, response = self.run_test("Seed Demo Data", "POST", "seed", 200)
        if success:
            if 'message' in response:
                self.log_test("Seed - Response message", True)
            else:
                self.log_test("Seed - Response message", False, "Missing message field")
        return success

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