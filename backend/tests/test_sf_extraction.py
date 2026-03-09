"""
Backend tests for SF extraction logic and recalculation endpoints.
Tests the webhook SF extraction from various payload formats and the new
/api/recalculate-sf and /api/reset-sf-history endpoints.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestWebhookSFExtraction:
    """Test SF extraction from various ChirpStack webhook payload formats"""
    
    def test_sf_extraction_from_root_level(self):
        """Test SF extraction when spreadingFactor is at root level (ChirpStack v4 format)"""
        # Use an existing device from the database
        devices_response = requests.get(f"{BASE_URL}/api/devices")
        assert devices_response.status_code == 200
        devices = devices_response.json()
        assert len(devices) > 0, "No devices found in database"
        
        test_device = devices[0]
        dev_eui = test_device["dev_eui"]
        
        # Send webhook with spreadingFactor at root level
        payload = {
            "devEui": dev_eui,
            "deviceName": test_device["name"],
            "spreadingFactor": 9,  # Root level SF
            "gatewayId": "TEST_GATEWAY_001",
            "rssi": -85,
            "snr": 7.5
        }
        
        response = requests.post(f"{BASE_URL}/api/chirpstack/webhook", json=payload)
        assert response.status_code == 200, f"Webhook failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "success"
        assert data["logs_created"] >= 1
        print(f"SUCCESS: Webhook processed with root-level SF=9 for device {dev_eui}")
        
        # Verify the uplink was created with correct SF
        uplinks_response = requests.get(f"{BASE_URL}/api/uplinks?dev_eui={dev_eui}&limit=1")
        assert uplinks_response.status_code == 200
        uplinks = uplinks_response.json()
        assert len(uplinks) > 0, "No uplinks found after webhook"
        
        latest_uplink = uplinks[0]
        assert latest_uplink["spreading_factor"] == 9, f"Expected SF=9, got SF={latest_uplink['spreading_factor']}"
        print(f"SUCCESS: Uplink created with correct SF=9")
    
    def test_sf_extraction_from_dr_field(self):
        """Test SF extraction from dr (DataRate) field - EU868 mapping"""
        devices_response = requests.get(f"{BASE_URL}/api/devices")
        devices = devices_response.json()
        test_device = devices[1] if len(devices) > 1 else devices[0]
        dev_eui = test_device["dev_eui"]
        
        # Send webhook with dr field (dr=3 should map to SF=9 in EU868)
        payload = {
            "devEui": dev_eui,
            "deviceName": test_device["name"],
            "dr": 3,  # DataRate 3 = SF9 in EU868
            "gatewayId": "TEST_GATEWAY_002",
            "rssi": -90,
            "snr": 5.0
        }
        
        response = requests.post(f"{BASE_URL}/api/chirpstack/webhook", json=payload)
        assert response.status_code == 200, f"Webhook failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "success"
        print(f"SUCCESS: Webhook processed with dr=3 for device {dev_eui}")
        
        # Verify the uplink was created with correct SF (dr=3 -> SF=9)
        uplinks_response = requests.get(f"{BASE_URL}/api/uplinks?dev_eui={dev_eui}&limit=1")
        uplinks = uplinks_response.json()
        latest_uplink = uplinks[0]
        assert latest_uplink["spreading_factor"] == 9, f"Expected SF=9 from dr=3, got SF={latest_uplink['spreading_factor']}"
        print(f"SUCCESS: DR=3 correctly mapped to SF=9")
    
    def test_sf_extraction_from_rxinfo(self):
        """Test SF extraction from rxInfo array"""
        devices_response = requests.get(f"{BASE_URL}/api/devices")
        devices = devices_response.json()
        test_device = devices[2] if len(devices) > 2 else devices[0]
        dev_eui = test_device["dev_eui"]
        
        # Send webhook with spreadingFactor in rxInfo
        payload = {
            "devEui": dev_eui,
            "deviceName": test_device["name"],
            "rxInfo": [
                {
                    "gatewayId": "TEST_GATEWAY_003",
                    "rssi": -95,
                    "snr": 3.0,
                    "spreadingFactor": 10  # SF in rxInfo
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/chirpstack/webhook", json=payload)
        assert response.status_code == 200, f"Webhook failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "success"
        print(f"SUCCESS: Webhook processed with rxInfo SF=10 for device {dev_eui}")
        
        # Verify the uplink was created with correct SF
        uplinks_response = requests.get(f"{BASE_URL}/api/uplinks?dev_eui={dev_eui}&limit=1")
        uplinks = uplinks_response.json()
        latest_uplink = uplinks[0]
        assert latest_uplink["spreading_factor"] == 10, f"Expected SF=10 from rxInfo, got SF={latest_uplink['spreading_factor']}"
        print(f"SUCCESS: SF=10 correctly extracted from rxInfo")
    
    def test_sf_extraction_priority_root_over_dr(self):
        """Test that root-level spreadingFactor takes priority over dr field"""
        devices_response = requests.get(f"{BASE_URL}/api/devices")
        devices = devices_response.json()
        test_device = devices[3] if len(devices) > 3 else devices[0]
        dev_eui = test_device["dev_eui"]
        
        # Send webhook with both spreadingFactor at root and dr field
        payload = {
            "devEui": dev_eui,
            "deviceName": test_device["name"],
            "spreadingFactor": 11,  # Root level - should take priority
            "dr": 5,  # dr=5 would map to SF=7, but should be ignored
            "gatewayId": "TEST_GATEWAY_004",
            "rssi": -100,
            "snr": 1.0
        }
        
        response = requests.post(f"{BASE_URL}/api/chirpstack/webhook", json=payload)
        assert response.status_code == 200, f"Webhook failed: {response.text}"
        
        # Verify root-level SF takes priority
        uplinks_response = requests.get(f"{BASE_URL}/api/uplinks?dev_eui={dev_eui}&limit=1")
        uplinks = uplinks_response.json()
        latest_uplink = uplinks[0]
        assert latest_uplink["spreading_factor"] == 11, f"Expected SF=11 (root priority), got SF={latest_uplink['spreading_factor']}"
        print(f"SUCCESS: Root-level SF=11 correctly takes priority over dr=5")


class TestRecalculateSFEndpoint:
    """Test the /api/recalculate-sf endpoint"""
    
    def test_recalculate_sf_endpoint_exists(self):
        """Test that the recalculate-sf endpoint exists and responds"""
        response = requests.post(f"{BASE_URL}/api/recalculate-sf")
        assert response.status_code == 200, f"Recalculate SF endpoint failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "success"
        assert "devices_with_data" in data
        assert "devices_without_data" in data
        print(f"SUCCESS: Recalculate SF endpoint working - {data['devices_with_data']} devices with data")
    
    def test_recalculate_sf_updates_device_buffers(self):
        """Test that recalculate-sf updates device SF buffers from uplinks"""
        # First, get a device that has uplinks
        uplinks_response = requests.get(f"{BASE_URL}/api/uplinks?limit=10")
        uplinks = uplinks_response.json()
        
        if len(uplinks) == 0:
            pytest.skip("No uplinks available for testing")
        
        # Get a device with uplinks
        dev_eui = uplinks[0]["dev_eui"]
        
        # Call recalculate
        response = requests.post(f"{BASE_URL}/api/recalculate-sf")
        assert response.status_code == 200
        
        # Check the device now has SF data
        devices_response = requests.get(f"{BASE_URL}/api/devices")
        devices = devices_response.json()
        
        device = next((d for d in devices if d["dev_eui"] == dev_eui), None)
        if device:
            print(f"Device {dev_eui}: sf_buffer={device.get('sf_buffer')}, sf_average={device.get('sf_average')}")
            # Device should have SF data if it has uplinks
            if len(device.get("sf_buffer", [])) > 0:
                assert device.get("sf_average") is not None
                print(f"SUCCESS: Device {dev_eui} has SF average: {device['sf_average']}")


class TestResetSFHistoryEndpoint:
    """Test the /api/reset-sf-history endpoint"""
    
    def test_reset_sf_history_endpoint_exists(self):
        """Test that the reset-sf-history endpoint exists and responds"""
        response = requests.post(f"{BASE_URL}/api/reset-sf-history")
        assert response.status_code == 200, f"Reset SF history endpoint failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "success"
        assert "devices_reset" in data
        print(f"SUCCESS: Reset SF history endpoint working - {data['devices_reset']} devices reset")
    
    def test_reset_sf_history_clears_buffers(self):
        """Test that reset-sf-history clears all SF buffers"""
        # First reset
        response = requests.post(f"{BASE_URL}/api/reset-sf-history")
        assert response.status_code == 200
        
        # Check devices have empty buffers
        devices_response = requests.get(f"{BASE_URL}/api/devices?limit=10")
        devices = devices_response.json()
        
        for device in devices[:5]:  # Check first 5 devices
            assert device.get("sf_buffer") == [], f"Device {device['dev_eui']} buffer not cleared"
            assert device.get("sf_average") is None, f"Device {device['dev_eui']} sf_average not cleared"
        
        print(f"SUCCESS: All device SF buffers cleared")
        
        # Restore by recalculating
        requests.post(f"{BASE_URL}/api/recalculate-sf")


class TestHeatmapEndpoint:
    """Test the /api/heatmap endpoint returns correct SF data"""
    
    def test_heatmap_returns_sf_data(self):
        """Test that heatmap endpoint returns SF average and buffer info"""
        response = requests.get(f"{BASE_URL}/api/heatmap")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check structure of heatmap points
        if len(data) > 0:
            point = data[0]
            assert "dev_eui" in point
            assert "name" in point
            assert "latitude" in point
            assert "longitude" in point
            assert "sf_average" in point
            assert "sf_buffer" in point
            assert "sf_buffer_size" in point
            assert "color_category" in point
            print(f"SUCCESS: Heatmap returns {len(data)} points with SF data")
    
    def test_heatmap_color_categories(self):
        """Test that heatmap color categories are correct based on SF average"""
        response = requests.get(f"{BASE_URL}/api/heatmap")
        data = response.json()
        
        for point in data:
            sf_avg = point.get("sf_average")
            color = point.get("color_category")
            
            if sf_avg is None:
                assert color == "unknown", f"Expected 'unknown' for null SF, got '{color}'"
            elif sf_avg <= 8.5:
                assert color == "good", f"Expected 'good' for SF={sf_avg}, got '{color}'"
            elif sf_avg <= 10.5:
                assert color == "medium", f"Expected 'medium' for SF={sf_avg}, got '{color}'"
            else:
                assert color == "bad", f"Expected 'bad' for SF={sf_avg}, got '{color}'"
        
        print(f"SUCCESS: All heatmap color categories are correct")


class TestStatsEndpoint:
    """Test the /api/stats endpoint"""
    
    def test_stats_returns_sf_distribution(self):
        """Test that stats endpoint returns SF distribution"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_gateways" in data
        assert "total_devices" in data
        assert "total_uplinks" in data
        assert "uplinks_today" in data
        assert "sf_distribution" in data
        
        print(f"SUCCESS: Stats - Gateways: {data['total_gateways']}, Devices: {data['total_devices']}, Uplinks: {data['total_uplinks']}")
        print(f"SF Distribution: {data['sf_distribution']}")


class TestDRMapping:
    """Test DataRate to SF mapping for EU868"""
    
    def test_dr_mapping_values(self):
        """Test all DR values map correctly to SF"""
        # EU868 DR mapping: {0: 12, 1: 11, 2: 10, 3: 9, 4: 8, 5: 7}
        dr_sf_mapping = {0: 12, 1: 11, 2: 10, 3: 9, 4: 8, 5: 7}
        
        devices_response = requests.get(f"{BASE_URL}/api/devices")
        devices = devices_response.json()
        
        if len(devices) < 6:
            pytest.skip("Not enough devices for DR mapping test")
        
        for dr, expected_sf in dr_sf_mapping.items():
            test_device = devices[dr % len(devices)]
            dev_eui = test_device["dev_eui"]
            
            payload = {
                "devEui": dev_eui,
                "deviceName": test_device["name"],
                "dr": dr,
                "gatewayId": f"TEST_DR_GATEWAY_{dr}",
                "rssi": -80 - dr * 5,
                "snr": 10 - dr
            }
            
            response = requests.post(f"{BASE_URL}/api/chirpstack/webhook", json=payload)
            assert response.status_code == 200
            
            # Verify SF
            uplinks_response = requests.get(f"{BASE_URL}/api/uplinks?dev_eui={dev_eui}&limit=1")
            uplinks = uplinks_response.json()
            actual_sf = uplinks[0]["spreading_factor"]
            
            assert actual_sf == expected_sf, f"DR={dr} should map to SF={expected_sf}, got SF={actual_sf}"
            print(f"SUCCESS: DR={dr} correctly maps to SF={expected_sf}")


class TestDeviceLocationCluj:
    """Test that devices are in Cluj area (not Bucharest)"""
    
    def test_devices_in_cluj_area(self):
        """Test that devices are located in Cluj area (~46.7N, 23.5E)"""
        response = requests.get(f"{BASE_URL}/api/devices")
        assert response.status_code == 200
        
        devices = response.json()
        assert len(devices) > 0
        
        # Cluj coordinates: ~46.7N, 23.5E
        # Bucharest coordinates: ~44.4N, 26.1E
        cluj_lat_range = (46.5, 47.0)
        cluj_lng_range = (23.3, 23.8)
        
        devices_in_cluj = 0
        for device in devices[:50]:  # Check first 50 devices
            lat = device.get("latitude", 0)
            lng = device.get("longitude", 0)
            
            if cluj_lat_range[0] <= lat <= cluj_lat_range[1] and cluj_lng_range[0] <= lng <= cluj_lng_range[1]:
                devices_in_cluj += 1
        
        # Most devices should be in Cluj area
        assert devices_in_cluj > 40, f"Expected most devices in Cluj area, found only {devices_in_cluj}/50"
        print(f"SUCCESS: {devices_in_cluj}/50 devices are in Cluj area (~46.7N, 23.5E)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
