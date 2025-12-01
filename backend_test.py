#!/usr/bin/env python3
"""
Backend API Testing for Prospekt Preisvergleich
Tests all backend endpoints with realistic German supermarket data
"""

import requests
import json
import sys
import time
from typing import Dict, List, Any

# Base URL from frontend environment
BASE_URL = "https://grocery-deal-finder-3.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.test_results = []
        self.supermarkets = []
        self.test_list_id = None
        self.test_alert_id = None

    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })

    def test_root_endpoint(self):
        """Test root API endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if "Prospekt Preisvergleich API" in data.get("message", ""):
                    self.log_test("Root endpoint", True, f"Version: {data.get('version', 'unknown')}")
                    return True
            self.log_test("Root endpoint", False, f"Status: {response.status_code}")
            return False
        except Exception as e:
            self.log_test("Root endpoint", False, f"Error: {str(e)}")
            return False

    def test_get_supermarkets(self):
        """Test GET /api/supermarkets"""
        try:
            response = self.session.get(f"{self.base_url}/supermarkets")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) >= 8:
                    self.supermarkets = data
                    expected_names = ["Aldi Nord", "Aldi Süd", "REWE", "Edeka", "Lidl", "Kaufland", "Penny", "Netto"]
                    found_names = [sm.get("name") for sm in data]
                    
                    missing = [name for name in expected_names if name not in found_names]
                    if not missing:
                        self.log_test("GET /supermarkets", True, f"Found {len(data)} supermarkets including all expected German chains")
                        return True
                    else:
                        self.log_test("GET /supermarkets", False, f"Missing supermarkets: {missing}")
                        return False
                else:
                    self.log_test("GET /supermarkets", False, f"Expected 8+ supermarkets, got {len(data) if isinstance(data, list) else 'invalid response'}")
                    return False
            else:
                self.log_test("GET /supermarkets", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /supermarkets", False, f"Error: {str(e)}")
            return False

    def test_toggle_supermarket(self):
        """Test PUT /api/supermarkets/{id}/toggle"""
        if not self.supermarkets:
            self.log_test("PUT /supermarkets/{id}/toggle", False, "No supermarkets available for testing")
            return False
        
        try:
            # Test with first supermarket
            sm_id = self.supermarkets[0].get("id")
            original_status = self.supermarkets[0].get("is_active", True)
            
            response = self.session.put(f"{self.base_url}/supermarkets/{sm_id}/toggle")
            if response.status_code == 200:
                data = response.json()
                new_status = data.get("is_active")
                if new_status != original_status:
                    # Toggle back
                    response2 = self.session.put(f"{self.base_url}/supermarkets/{sm_id}/toggle")
                    if response2.status_code == 200:
                        self.log_test("PUT /supermarkets/{id}/toggle", True, f"Successfully toggled {self.supermarkets[0].get('name')} status")
                        return True
                    else:
                        self.log_test("PUT /supermarkets/{id}/toggle", False, "Failed to toggle back")
                        return False
                else:
                    self.log_test("PUT /supermarkets/{id}/toggle", False, "Status did not change")
                    return False
            else:
                self.log_test("PUT /supermarkets/{id}/toggle", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("PUT /supermarkets/{id}/toggle", False, f"Error: {str(e)}")
            return False

    def test_scan_prospekts(self):
        """Test POST /api/scan"""
        try:
            payload = {
                "supermarket_ids": [],
                "force_refresh": False
            }
            response = self.session.post(f"{self.base_url}/scan", json=payload)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "scanning":
                    self.log_test("POST /scan", True, "Scan triggered successfully")
                    # Wait a bit for background task
                    time.sleep(2)
                    return True
                else:
                    self.log_test("POST /scan", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("POST /scan", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("POST /scan", False, f"Error: {str(e)}")
            return False

    def test_get_products(self):
        """Test GET /api/products with various filters"""
        try:
            # Test basic products endpoint
            response = self.session.get(f"{self.base_url}/products")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("GET /products (basic)", True, f"Retrieved {len(data)} products")
                    
                    # Test with category filter
                    response2 = self.session.get(f"{self.base_url}/products?category=Milchprodukte")
                    if response2.status_code == 200:
                        dairy_products = response2.json()
                        self.log_test("GET /products (category filter)", True, f"Found {len(dairy_products)} dairy products")
                        
                        # Test with search
                        response3 = self.session.get(f"{self.base_url}/products?search=butter")
                        if response3.status_code == 200:
                            butter_products = response3.json()
                            self.log_test("GET /products (search)", True, f"Found {len(butter_products)} products matching 'butter'")
                            return True
                        else:
                            self.log_test("GET /products (search)", False, f"Status: {response3.status_code}")
                            return False
                    else:
                        self.log_test("GET /products (category filter)", False, f"Status: {response2.status_code}")
                        return False
                else:
                    self.log_test("GET /products (basic)", False, "Response is not a list")
                    return False
            else:
                self.log_test("GET /products (basic)", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /products", False, f"Error: {str(e)}")
            return False

    def test_compare_products(self):
        """Test GET /api/products/compare"""
        try:
            response = self.session.get(f"{self.base_url}/products/compare?search=butter")
            if response.status_code == 200:
                data = response.json()
                if "search_term" in data and "results" in data:
                    results = data.get("results", [])
                    cheapest = data.get("cheapest")
                    self.log_test("GET /products/compare", True, f"Compared butter across {len(results)} supermarkets, cheapest: {cheapest.get('supermarket_name') if cheapest else 'none'}")
                    return True
                else:
                    self.log_test("GET /products/compare", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("GET /products/compare", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /products/compare", False, f"Error: {str(e)}")
            return False

    def test_shopping_lists_crud(self):
        """Test Shopping Lists CRUD operations"""
        success_count = 0
        total_tests = 7
        
        # 1. Create shopping list
        try:
            payload = {
                "name": "Wocheneinkauf Test",
                "plz": "10115"
            }
            response = self.session.post(f"{self.base_url}/lists", json=payload)
            if response.status_code == 200:
                data = response.json()
                self.test_list_id = data.get("id")
                self.log_test("POST /lists (create)", True, f"Created list: {data.get('name')}")
                success_count += 1
            else:
                self.log_test("POST /lists (create)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /lists (create)", False, f"Error: {str(e)}")

        # 2. Get all lists
        try:
            response = self.session.get(f"{self.base_url}/lists")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("GET /lists", True, f"Retrieved {len(data)} shopping lists")
                    success_count += 1
                else:
                    self.log_test("GET /lists", False, "Response is not a list")
            else:
                self.log_test("GET /lists", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /lists", False, f"Error: {str(e)}")

        if not self.test_list_id:
            self.log_test("Shopping Lists CRUD", False, "Cannot continue without list ID")
            return False

        # 3. Add item to list
        try:
            payload = {
                "product_name": "Butter",
                "quantity": 2
            }
            response = self.session.post(f"{self.base_url}/lists/{self.test_list_id}/items", json=payload)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    self.log_test("POST /lists/{id}/items", True, f"Added item: {payload['product_name']}")
                    success_count += 1
                else:
                    self.log_test("POST /lists/{id}/items", False, f"Unexpected response: {data}")
            else:
                self.log_test("POST /lists/{id}/items", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /lists/{id}/items", False, f"Error: {str(e)}")

        # 4. Add another item
        try:
            payload = {
                "product_name": "Milch",
                "quantity": 1
            }
            response = self.session.post(f"{self.base_url}/lists/{self.test_list_id}/items", json=payload)
            if response.status_code == 200:
                self.log_test("POST /lists/{id}/items (second item)", True, f"Added item: {payload['product_name']}")
                success_count += 1
            else:
                self.log_test("POST /lists/{id}/items (second item)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /lists/{id}/items (second item)", False, f"Error: {str(e)}")

        # 5. Toggle item checked
        try:
            response = self.session.put(f"{self.base_url}/lists/{self.test_list_id}/items/0/toggle")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    self.log_test("PUT /lists/{id}/items/{index}/toggle", True, f"Toggled item checked: {data.get('checked')}")
                    success_count += 1
                else:
                    self.log_test("PUT /lists/{id}/items/{index}/toggle", False, f"Unexpected response: {data}")
            else:
                self.log_test("PUT /lists/{id}/items/{index}/toggle", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("PUT /lists/{id}/items/{index}/toggle", False, f"Error: {str(e)}")

        # 6. Remove item
        try:
            response = self.session.delete(f"{self.base_url}/lists/{self.test_list_id}/items/1")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    self.log_test("DELETE /lists/{id}/items/{index}", True, "Removed item from list")
                    success_count += 1
                else:
                    self.log_test("DELETE /lists/{id}/items/{index}", False, f"Unexpected response: {data}")
            else:
                self.log_test("DELETE /lists/{id}/items/{index}", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("DELETE /lists/{id}/items/{index}", False, f"Error: {str(e)}")

        # 7. Delete list
        try:
            response = self.session.delete(f"{self.base_url}/lists/{self.test_list_id}")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    self.log_test("DELETE /lists/{id}", True, "Deleted shopping list")
                    success_count += 1
                else:
                    self.log_test("DELETE /lists/{id}", False, f"Unexpected response: {data}")
            else:
                self.log_test("DELETE /lists/{id}", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("DELETE /lists/{id}", False, f"Error: {str(e)}")

        return success_count == total_tests

    def test_price_alerts_crud(self):
        """Test Price Alerts CRUD operations"""
        success_count = 0
        total_tests = 3

        # 1. Create price alert
        try:
            payload = {
                "product_name": "Butter",
                "target_price": 2.00,
                "supermarket_ids": []
            }
            response = self.session.post(f"{self.base_url}/alerts", json=payload)
            if response.status_code == 200:
                data = response.json()
                self.test_alert_id = data.get("id")
                self.log_test("POST /alerts", True, f"Created alert for {data.get('product_name')} at €{data.get('target_price')}")
                success_count += 1
            else:
                self.log_test("POST /alerts", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /alerts", False, f"Error: {str(e)}")

        # 2. Get all alerts
        try:
            response = self.session.get(f"{self.base_url}/alerts")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("GET /alerts", True, f"Retrieved {len(data)} price alerts")
                    success_count += 1
                else:
                    self.log_test("GET /alerts", False, "Response is not a list")
            else:
                self.log_test("GET /alerts", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /alerts", False, f"Error: {str(e)}")

        # 3. Delete alert
        if self.test_alert_id:
            try:
                response = self.session.delete(f"{self.base_url}/alerts/{self.test_alert_id}")
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "success":
                        self.log_test("DELETE /alerts/{id}", True, "Deleted price alert")
                        success_count += 1
                    else:
                        self.log_test("DELETE /alerts/{id}", False, f"Unexpected response: {data}")
                else:
                    self.log_test("DELETE /alerts/{id}", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("DELETE /alerts/{id}", False, f"Error: {str(e)}")
        else:
            self.log_test("DELETE /alerts/{id}", False, "No alert ID available")

        return success_count == total_tests

    def test_settings(self):
        """Test Settings endpoints"""
        success_count = 0
        total_tests = 2

        # 1. Get settings
        try:
            response = self.session.get(f"{self.base_url}/settings")
            if response.status_code == 200:
                data = response.json()
                if "id" in data:
                    self.log_test("GET /settings", True, f"Retrieved settings with PLZ: {data.get('plz', 'not set')}")
                    success_count += 1
                else:
                    self.log_test("GET /settings", False, f"Invalid settings structure: {data}")
            else:
                self.log_test("GET /settings", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /settings", False, f"Error: {str(e)}")

        # 2. Update settings
        try:
            payload = {
                "plz": "10115",
                "selected_supermarkets": [sm.get("id") for sm in self.supermarkets[:3]] if self.supermarkets else []
            }
            response = self.session.put(f"{self.base_url}/settings", json=payload)
            if response.status_code == 200:
                data = response.json()
                if data.get("plz") == "10115":
                    self.log_test("PUT /settings", True, f"Updated PLZ to {data.get('plz')}")
                    success_count += 1
                else:
                    self.log_test("PUT /settings", False, f"PLZ not updated correctly: {data}")
            else:
                self.log_test("PUT /settings", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("PUT /settings", False, f"Error: {str(e)}")

        return success_count == total_tests

    def test_categories(self):
        """Test GET /api/categories"""
        try:
            response = self.session.get(f"{self.base_url}/categories")
            if response.status_code == 200:
                data = response.json()
                categories = data.get("categories", [])
                expected_categories = ["Obst & Gemüse", "Fleisch & Wurst", "Milchprodukte", "Brot & Backwaren"]
                
                if all(cat in categories for cat in expected_categories):
                    self.log_test("GET /categories", True, f"Found {len(categories)} categories including expected German categories")
                    return True
                else:
                    self.log_test("GET /categories", False, f"Missing expected categories. Got: {categories}")
                    return False
            else:
                self.log_test("GET /categories", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("GET /categories", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🧪 Starting Backend API Tests for Prospekt Preisvergleich")
        print(f"🌐 Base URL: {self.base_url}")
        print("=" * 60)

        # Core API tests
        self.test_root_endpoint()
        self.test_get_supermarkets()
        self.test_toggle_supermarket()
        self.test_scan_prospekts()
        self.test_get_products()
        self.test_compare_products()
        self.test_categories()
        
        # CRUD operations that need testing
        print("\n📝 Testing Shopping Lists CRUD...")
        shopping_lists_success = self.test_shopping_lists_crud()
        
        print("\n🔔 Testing Price Alerts CRUD...")
        price_alerts_success = self.test_price_alerts_crud()
        
        print("\n⚙️ Testing Settings...")
        settings_success = self.test_settings()

        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Critical feature status
        print("\n🎯 CRITICAL FEATURES STATUS:")
        print(f"Shopping Lists CRUD: {'✅ WORKING' if shopping_lists_success else '❌ FAILED'}")
        print(f"Price Alerts CRUD: {'✅ WORKING' if price_alerts_success else '❌ FAILED'}")
        print(f"Settings: {'✅ WORKING' if settings_success else '❌ FAILED'}")
        
        # Failed tests details
        failed_tests = [result for result in self.test_results if not result['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  • {test['test']}: {test['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)