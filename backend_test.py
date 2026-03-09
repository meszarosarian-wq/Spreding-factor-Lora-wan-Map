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

    def test_groups_crud(self):
        """Test Groups CRUD operations"""
        # Create first group
        group1_data = {
            "name": "București Nord",
            "description": "Senzori zona nord"
        }
        success, created_group1 = self.run_test("Create Group București Nord", "POST", "groups", 200, group1_data)
        if not success:
            return False

        group1_id = created_group1.get('id')
        if not group1_id:
            self.log_test("Group Creation - ID", False, "No ID returned")
            return False

        # Verify group creation
        if created_group1.get('name') == "București Nord" and created_group1.get('description') == "Senzori zona nord":
            self.log_test("Group Creation - Data correct", True)
        else:
            self.log_test("Group Creation - Data correct", False, f"Incorrect data: {created_group1}")

        # Get all groups
        success, all_groups = self.run_test("Get All Groups", "GET", "groups", 200)
        if not success:
            return False

        # Verify group appears in list
        found_group = None
        for group in all_groups:
            if group.get('id') == group1_id:
                found_group = group
                break

        if found_group:
            self.log_test("Group - Found in list", True)
        else:
            self.log_test("Group - Found in list", False, "Created group not found in list")

        # Update group
        updated_group_data = {
            "name": "București Nord Updated",
            "description": "Updated desc"
        }
        success, updated_group = self.run_test("Update Group", "PUT", f"groups/{group1_id}", 200, updated_group_data)
        if not success:
            return False

        if updated_group.get('name') == "București Nord Updated" and updated_group.get('description') == "Updated desc":
            self.log_test("Group Update - Data correct", True)
        else:
            self.log_test("Group Update - Data correct", False, f"Update data incorrect: {updated_group}")

        # Create second group
        group2_data = {
            "name": "București Sud",
            "description": "Zona sud"
        }
        success, created_group2 = self.run_test("Create Second Group București Sud", "POST", "groups", 200, group2_data)
        if not success:
            return False

        group2_id = created_group2.get('id')
        if not group2_id:
            self.log_test("Second Group Creation - ID", False, "No ID returned")
            return False

        return True, group1_id, group2_id

    def test_device_group_assignment(self, group_id):
        """Test assigning devices to groups"""
        # First get an existing device or create one
        success, devices = self.run_test("Get Devices for Group Assignment", "GET", "devices", 200)
        if not success:
            return False

        device_id = None
        device_dev_eui = None

        # Use existing device if available, otherwise create one
        if devices and len(devices) > 0:
            device_id = devices[0]['id']
            device_dev_eui = devices[0]['dev_eui']
        else:
            # Create a test device
            test_device = {
                "dev_eui": "AABBCCDDEEFF9999",
                "name": "Test Device for Group",
                "latitude": 44.4300,
                "longitude": 26.1050
            }
            success, created_device = self.run_test("Create Test Device for Group", "POST", "devices", 200, test_device)
            if not success:
                return False
            device_id = created_device.get('id')
            device_dev_eui = created_device.get('dev_eui')

        if not device_id:
            self.log_test("Device for Group Assignment", False, "No device available")
            return False

        # Update device to assign it to group
        # First get current device data
        success, current_device = self.run_test("Get Device for Assignment", "GET", f"devices/{device_id}", 200)
        if not success:
            return False

        # Update with group assignment
        update_data = {
            "dev_eui": current_device['dev_eui'],
            "name": current_device['name'],
            "latitude": current_device['latitude'],
            "longitude": current_device['longitude'],
            "group_id": group_id
        }

        success, updated_device = self.run_test("Assign Device to Group", "PUT", f"devices/{device_id}", 200, update_data)
        if not success:
            return False

        # Verify device has group assignment
        if updated_device.get('group_id') == group_id:
            self.log_test("Device Group Assignment - group_id set", True)
        else:
            self.log_test("Device Group Assignment - group_id set", False, f"Group ID not set: {updated_device.get('group_id')}")

        if updated_device.get('group_name'):
            self.log_test("Device Group Assignment - group_name set", True)
        else:
            self.log_test("Device Group Assignment - group_name set", False, "Group name not set")

        return True, device_id, device_dev_eui

    def test_group_filtering_devices(self, group_id):
        """Test device filtering by group"""
        # Test devices filtering with group_id
        success, filtered_devices = self.run_test("Filter Devices by Group", "GET", f"devices?group_id={group_id}", 200)
        if not success:
            return False

        if isinstance(filtered_devices, list):
            self.log_test("Device Group Filter - Response is list", True)
        else:
            self.log_test("Device Group Filter - Response is list", False, "Response not a list")
            return False

        # Verify all returned devices belong to the group
        all_correct_group = True
        for device in filtered_devices:
            if device.get('group_id') != group_id:
                all_correct_group = False
                break

        if all_correct_group or len(filtered_devices) == 0:
            self.log_test("Device Group Filter - All devices in correct group", True)
        else:
            self.log_test("Device Group Filter - All devices in correct group", False, "Some devices not in correct group")

        # Test devices without group filter (should return all devices)
        success, all_devices = self.run_test("Get All Devices (no filter)", "GET", "devices", 200)
        if success and len(all_devices) >= len(filtered_devices):
            self.log_test("Device No Filter - Returns all devices", True)
        else:
            self.log_test("Device No Filter - Returns all devices", False, f"All: {len(all_devices) if success else 'error'}, Filtered: {len(filtered_devices)}")

        return True

    def test_group_filtering_heatmap(self, group_id):
        """Test heatmap filtering by group"""
        # Test heatmap with group filter
        success, filtered_heatmap = self.run_test("Filter Heatmap by Group", "GET", f"heatmap?group_id={group_id}", 200)
        if not success:
            return False

        if isinstance(filtered_heatmap, list):
            self.log_test("Heatmap Group Filter - Response is list", True)
        else:
            self.log_test("Heatmap Group Filter - Response is list", False, "Response not a list")
            return False

        # Verify heatmap includes group fields
        if len(filtered_heatmap) > 0:
            point = filtered_heatmap[0]
            group_fields = ['group_id', 'group_name']
            for field in group_fields:
                if field in point:
                    self.log_test(f"Heatmap Group Filter - {field} field present", True)
                else:
                    self.log_test(f"Heatmap Group Filter - {field} field present", False, f"Missing {field}")

            # Verify all points belong to the correct group
            all_correct_group = True
            for point in filtered_heatmap:
                if point.get('group_id') != group_id:
                    all_correct_group = False
                    break

            if all_correct_group:
                self.log_test("Heatmap Group Filter - All points in correct group", True)
            else:
                self.log_test("Heatmap Group Filter - All points in correct group", False, "Some points not in correct group")

        # Test heatmap without filter
        success, all_heatmap = self.run_test("Get All Heatmap (no filter)", "GET", "heatmap", 200)
        if success and len(all_heatmap) >= len(filtered_heatmap):
            self.log_test("Heatmap No Filter - Returns all devices", True)
        else:
            self.log_test("Heatmap No Filter - Returns all devices", False, f"All: {len(all_heatmap) if success else 'error'}, Filtered: {len(filtered_heatmap)}")

        return True

    def test_group_filtering_stats(self, group_id):
        """Test stats filtering by group"""
        # Test stats with group filter
        success, group_stats = self.run_test("Filter Stats by Group", "GET", f"stats?group_id={group_id}", 200)
        if not success:
            return False

        required_fields = ['total_gateways', 'total_devices', 'total_uplinks', 'uplinks_today', 'sf_distribution']
        for field in required_fields:
            if field not in group_stats:
                self.log_test(f"Group Stats - {field} field", False, f"Missing field: {field}")
                return False

        # Test stats without group filter
        success, all_stats = self.run_test("Get All Stats (no filter)", "GET", "stats", 200)
        if success:
            # Group stats should have <= devices than all stats (unless no ungrouped devices)
            if group_stats['total_devices'] <= all_stats['total_devices']:
                self.log_test("Group Stats - Device count logical", True)
            else:
                self.log_test("Group Stats - Device count logical", False, f"Group: {group_stats['total_devices']}, All: {all_stats['total_devices']}")

        self.log_test("Group Stats - All fields present", True)
        return True

    def test_group_filtering_analytics(self, group_id):
        """Test analytics filtering by group"""
        # Test SF distribution with group filter
        success, group_sf_dist = self.run_test("Filter SF Distribution by Group", "GET", f"analytics/sf-distribution?group_id={group_id}", 200)
        if not success:
            return False

        required_fields = ['distribution', 'total_uplinks']
        for field in required_fields:
            if field not in group_sf_dist:
                self.log_test(f"Group SF Distribution - {field} field", False, f"Missing field: {field}")
                return False

        # Test top problematic with group filter
        success, group_problematic = self.run_test("Filter Top Problematic by Group", "GET", f"analytics/top-problematic?group_id={group_id}", 200)
        if not success:
            return False

        if 'nodes' in group_problematic and isinstance(group_problematic['nodes'], list):
            self.log_test("Group Top Problematic - Nodes is list", True)
        else:
            self.log_test("Group Top Problematic - Nodes is list", False, "Nodes field missing or not a list")

        self.log_test("Group Analytics - All endpoints work", True)
        return True

    def test_webhook_tenant_name(self):
        """Test webhook with tenantName and applicationName"""
        # Test webhook payload with tenant and application info
        webhook_payload = {
            "devEui": "0011223344556601",
            "deviceInfo": {
                "tenantName": "MyTenant",
                "applicationName": "MyApp"
            },
            "spreadingFactor": 7,
            "rxInfo": [
                {
                    "gatewayId": "AA00BB11CC22DD33",
                    "rssi": -75,
                    "snr": 8.0
                }
            ]
        }

        success, response = self.run_test("Webhook with tenantName", "POST", "chirpstack/webhook", 200, webhook_payload)
        if not success:
            return False

        if response.get('status') == 'success':
            self.log_test("Webhook Tenant - Success status", True)
        else:
            self.log_test("Webhook Tenant - Success status", False, f"Status: {response.get('status')}")

        # Check uplinks to verify tenant_name field is stored
        time.sleep(1)  # Small delay
        success, uplinks = self.run_test("Get Uplinks after Tenant Webhook", "GET", "uplinks?dev_eui=0011223344556601&limit=1", 200)
        if success and len(uplinks) > 0:
            uplink = uplinks[0]
            if uplink.get('tenant_name') == 'MyTenant':
                self.log_test("Webhook Tenant - tenant_name stored", True)
            else:
                self.log_test("Webhook Tenant - tenant_name stored", False, f"tenant_name: {uplink.get('tenant_name')}")

            if uplink.get('application_name') == 'MyApp':
                self.log_test("Webhook Tenant - application_name stored", True)
            else:
                self.log_test("Webhook Tenant - application_name stored", False, f"application_name: {uplink.get('application_name')}")
        else:
            self.log_test("Webhook Tenant - Uplink verification", False, "No uplinks found to verify")

        return True

    def test_group_deletion(self, group_id):
        """Test group deletion and device unassignment"""
        # Delete the group
        success, response = self.run_test("Delete Group", "DELETE", f"groups/{group_id}", 200)
        if not success:
            return False

        if 'message' in response and 'unassigned' in response['message'].lower():
            self.log_test("Group Delete - Success message", True)
        else:
            self.log_test("Group Delete - Success message", False, f"Message: {response.get('message')}")

        # Verify devices are unassigned (group_id should be null)
        success, devices = self.run_test("Get Devices after Group Delete", "GET", "devices", 200)
        if success:
            # Check that no device has the deleted group_id
            devices_still_assigned = [d for d in devices if d.get('group_id') == group_id]
            if len(devices_still_assigned) == 0:
                self.log_test("Group Delete - Devices unassigned", True)
            else:
                self.log_test("Group Delete - Devices unassigned", False, f"Devices still assigned: {len(devices_still_assigned)}")

        # Verify group is deleted by checking if it appears in groups list
        success, remaining_groups = self.run_test("Get Groups After Delete", "GET", "groups", 200)
        if success:
            deleted_group_found = any(g.get('id') == group_id for g in remaining_groups)
            if not deleted_group_found:
                self.log_test("Verify Group Deleted - Not in list", True)
            else:
                self.log_test("Verify Group Deleted - Not in list", False, "Deleted group still found in list")
        
        return True

    def test_legacy_compatibility(self):
        """Test that devices without group_id still work in all endpoints"""
        # Create a device without group assignment
        legacy_device = {
            "dev_eui": "LEGACY0000000001",
            "name": "Legacy Device Test",
            "latitude": 44.4300,
            "longitude": 26.1050
        }
        
        success, created_device = self.run_test("Create Legacy Device (no group)", "POST", "devices", 200, legacy_device)
        if not success:
            return False

        device_id = created_device.get('id')
        if not device_id:
            self.log_test("Legacy Device Creation", False, "No ID returned")
            return False

        # Verify device works in GET /api/devices
        success, devices = self.run_test("Legacy - GET devices", "GET", "devices", 200)
        if not success:
            return False

        legacy_found = any(d.get('id') == device_id for d in devices)
        if legacy_found:
            self.log_test("Legacy - Device in devices list", True)
        else:
            self.log_test("Legacy - Device in devices list", False, "Legacy device not found")

        # Verify device works in GET /api/heatmap
        success, heatmap = self.run_test("Legacy - GET heatmap", "GET", "heatmap", 200)
        if success:
            legacy_in_heatmap = any(h.get('dev_eui') == "LEGACY0000000001" for h in heatmap)
            if legacy_in_heatmap:
                self.log_test("Legacy - Device in heatmap", True)
            else:
                self.log_test("Legacy - Device in heatmap", False, "Legacy device not in heatmap")
        else:
            return False

        # Clean up - delete legacy device
        self.run_test("Delete Legacy Device", "DELETE", f"devices/{device_id}", 200)

        self.log_test("Legacy Compatibility - All tests passed", True)
        return True

    def run_groups_tests(self):
        """Run all Groups/Projects system tests"""
        print("🔄 Testing Groups/Projects System...")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)

        # Test 1: Groups CRUD
        result = self.test_groups_crud()
        if not result:
            return False
        
        success, group1_id, group2_id = result

        # Test 2: Device group assignment
        result = self.test_device_group_assignment(group1_id)
        if not result:
            return False
        
        success, device_id, device_dev_eui = result

        # Test 3: Group filtering on devices
        self.test_group_filtering_devices(group1_id)

        # Test 4: Group filtering on heatmap
        self.test_group_filtering_heatmap(group1_id)

        # Test 5: Group filtering on stats
        self.test_group_filtering_stats(group1_id)

        # Test 6: Group filtering on analytics
        self.test_group_filtering_analytics(group1_id)

        # Test 7: Webhook with tenantName
        self.test_webhook_tenant_name()

        # Test 8: Legacy compatibility
        self.test_legacy_compatibility()

        # Test 9: Group deletion (clean up)
        self.test_group_deletion(group1_id)
        self.test_group_deletion(group2_id)

        # Print summary
        print("=" * 50)
        print(f"📊 Groups System Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All Groups/Projects system tests passed!")
            return 0
        else:
            print("❌ Some Groups/Projects system tests failed!")
            failed_tests = [r for r in self.test_results if not r['success']]
            print("\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
            return 1

def main():
    tester = LoRaWANAPITester()
    return tester.run_groups_tests()

if __name__ == "__main__":
    sys.exit(main())