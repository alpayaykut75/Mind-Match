#!/usr/bin/env python3
"""
Backend API Testing for MindMatch - Unread Message Endpoints
Testing the new unread message endpoints and badge system
"""

import requests
import json
import os
from datetime import datetime
import asyncio
import motor.motor_asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

# Get backend URL from frontend env
with open('/app/frontend/.env', 'r') as f:
    for line in f:
        if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
            BACKEND_URL = line.split('=')[1].strip()
            break

API_BASE = f"{BACKEND_URL}/api"
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "mindmatch_db")

print(f"🔗 Testing Backend: {API_BASE}")
print(f"🔗 MongoDB: {MONGO_URL}")

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name, success, message=""):
        self.results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat()
        })
        if success:
            self.passed += 1
            print(f"✅ {test_name}: {message}")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {message}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n📊 TEST SUMMARY")
        print(f"Total Tests: {total}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/total*100):.1f}%" if total > 0 else "No tests run")
        return self.passed, self.failed

# Global test results
results = TestResults()

def test_endpoint(method, endpoint, data=None, headers=None, expected_status=200):
    """Helper function to test API endpoints"""
    try:
        url = f"{API_BASE}{endpoint}"
        
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=10)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=10)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        
        if response.status_code == expected_status:
            try:
                return True, response.json()
            except:
                return True, response.text
        else:
            return False, f"Expected {expected_status}, got {response.status_code}: {response.text}"
    
    except Exception as e:
        return False, f"Request failed: {str(e)}"

async def verify_mongodb_data():
    """Verify MongoDB data for unread messages"""
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        chats_collection = db["chats"]
        
        # Check for unread messages from alpay_test to aslan_test
        unread_messages = await chats_collection.find({
            "from_username": "alpay_test",
            "to_username": "aslan_test", 
            "read": False
        }).to_list(100)
        
        client.close()
        
        if len(unread_messages) > 0:
            results.add_result("MongoDB Verification", True, f"Found {len(unread_messages)} unread messages from alpay_test to aslan_test")
            return True
        else:
            results.add_result("MongoDB Verification", False, "No unread messages found in MongoDB")
            return False
            
    except Exception as e:
        results.add_result("MongoDB Verification", False, f"MongoDB error: {str(e)}")
        return False

def main():
    print("🚀 Starting Unread Message Endpoints Testing")
    print("=" * 60)
    
    # Test users
    alpay_token = None
    aslan_token = None
    
    # 1. Health Check
    success, response = test_endpoint("GET", "/health")
    results.add_result("Health Check", success, str(response))
    
    # 2. Create/Login alpay user
    print("\n📝 Setting up alpay user...")
    
    # Try signup first - use timestamp to ensure unique users
    import time
    timestamp = str(int(time.time()))
    alpay_username = f"alpay_test_{timestamp}"
    aslan_username = f"aslan_test_{timestamp}"
    
    alpay_data = {
        "username": alpay_username,
        "password": "alpay123",
        "bio": "Test user alpay",
        "age": 25,
        "country": "Turkey"
    }
    
    success, response = test_endpoint("POST", "/auth/signup", alpay_data)
    if not success and "already exists" in str(response):
        # User exists, try login
        login_data = {"username": alpay_username, "password": "alpay123"}
        success, response = test_endpoint("POST", "/auth/login", login_data)
        
    if success and isinstance(response, dict) and "token" in response:
        alpay_token = response["token"]
        results.add_result("Alpay Authentication", True, "Successfully authenticated alpay")
    else:
        results.add_result("Alpay Authentication", False, f"Failed to authenticate alpay: {response}")
        return
    
    # 3. Create/Login aslan user
    print("\n📝 Setting up aslan user...")
    
    aslan_data = {
        "username": aslan_username,
        "password": "aslan123", 
        "bio": "Test user aslan",
        "age": 28,
        "country": "Turkey"
    }
    
    success, response = test_endpoint("POST", "/auth/signup", aslan_data)
    if not success and "already exists" in str(response):
        # User exists, try login
        login_data = {"username": aslan_username, "password": "aslan123"}
        success, response = test_endpoint("POST", "/auth/login", login_data)
        
    if success and isinstance(response, dict) and "token" in response:
        aslan_token = response["token"]
        results.add_result("Aslan Authentication", True, "Successfully authenticated aslan")
    else:
        results.add_result("Aslan Authentication", False, f"Failed to authenticate aslan: {response}")
        return
    
    # 4. Establish friendship between alpay and aslan
    print("\n🤝 Establishing friendship...")
    
    alpay_headers = {"Authorization": f"Bearer {alpay_token}"}
    aslan_headers = {"Authorization": f"Bearer {aslan_token}"}
    
    # Alpay sends friend request to aslan
    friend_request = {"to_username": aslan_username}
    success, response = test_endpoint("POST", "/friends/request", friend_request, alpay_headers)
    if not success and "already exists" not in str(response):
        results.add_result("Friend Request", False, f"Failed to send friend request: {response}")
        return
    
    # Aslan accepts friend request from alpay
    success, response = test_endpoint("POST", f"/friends/accept/{alpay_username}", None, aslan_headers)
    if success or "already" in str(response).lower():
        results.add_result("Friendship Established", True, f"{alpay_username} and {aslan_username} are now friends")
    else:
        results.add_result("Friendship Established", False, f"Failed to establish friendship: {response}")
        return
    
    # 5. TEST 1: POST /api/chat/send - Alpay sends message to Aslan
    print(f"\n💬 TEST 1: Sending message from {alpay_username} to {aslan_username}...")
    
    message_data = {
        "to_username": aslan_username,
        "message": "Hello Aslan!"
    }
    
    success, response = test_endpoint("POST", "/chat/send", message_data, alpay_headers)
    if success:
        results.add_result(f"Send Message ({alpay_username} → {aslan_username})", True, "Message sent successfully")
    else:
        results.add_result(f"Send Message ({alpay_username} → {aslan_username})", False, f"Failed to send message: {response}")
        return
    
    # 6. TEST 2: GET /api/chat/unread-count - Check Aslan's unread count
    print("\n📊 TEST 2: Checking aslan's unread count...")
    
    success, response = test_endpoint("GET", "/chat/unread-count", None, aslan_headers)
    if success and isinstance(response, dict):
        if "unread_count" in response:
            unread_count = response["unread_count"]
            if unread_count > 0:
                results.add_result("Unread Count Endpoint", True, f"Found {unread_count} unread messages for aslan")
            else:
                results.add_result("Unread Count Endpoint", False, "Unread count is 0, expected > 0")
        else:
            results.add_result("Unread Count Endpoint", False, f"Response missing 'unread_count' field: {response}")
    else:
        results.add_result("Unread Count Endpoint", False, f"Failed to get unread count: {response}")
    
    # 7. TEST 3: GET /api/chat/unread-by-user - Check unread messages per user
    print("\n👥 TEST 3: Checking unread messages by user...")
    
    success, response = test_endpoint("GET", "/chat/unread-by-user", None, aslan_headers)
    if success and isinstance(response, dict):
        if alpay_username in response and response[alpay_username] > 0:
            results.add_result("Unread By User Endpoint", True, f"Found {response[alpay_username]} unread messages from {alpay_username}")
        else:
            results.add_result("Unread By User Endpoint", False, f"No unread messages from {alpay_username} found: {response}")
    else:
        results.add_result("Unread By User Endpoint", False, f"Failed to get unread by user: {response}")
    
    # 8. TEST 4: Verify MongoDB data
    print("\n🗄️ TEST 4: Verifying MongoDB data...")
    
    # Run async MongoDB verification with dynamic usernames
    async def verify_mongodb_data_dynamic():
        try:
            client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
            db = client[DB_NAME]
            chats_collection = db["chats"]
            
            # Check for unread messages from alpay to aslan
            unread_messages = await chats_collection.find({
                "from_username": alpay_username,
                "to_username": aslan_username, 
                "read": False
            }).to_list(100)
            
            client.close()
            
            if len(unread_messages) > 0:
                results.add_result("MongoDB Verification", True, f"Found {len(unread_messages)} unread messages from {alpay_username} to {aslan_username}")
                return True
            else:
                results.add_result("MongoDB Verification", False, "No unread messages found in MongoDB")
                return False
                
        except Exception as e:
            results.add_result("MongoDB Verification", False, f"MongoDB error: {str(e)}")
            return False
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(verify_mongodb_data_dynamic())
    loop.close()
    
    # 9. Additional test: Send another message and verify counts increase
    print("\n📈 BONUS TEST: Sending second message...")
    
    message_data2 = {
        "to_username": aslan_username, 
        "message": "How are you doing?"
    }
    
    success, response = test_endpoint("POST", "/chat/send", message_data2, alpay_headers)
    if success:
        # Check updated unread count
        success2, response2 = test_endpoint("GET", "/chat/unread-count", None, aslan_headers)
        if success2 and isinstance(response2, dict) and "unread_count" in response2:
            new_count = response2["unread_count"]
            if new_count >= 2:
                results.add_result("Multiple Messages Test", True, f"Unread count correctly increased to {new_count}")
            else:
                results.add_result("Multiple Messages Test", False, f"Expected count >= 2, got {new_count}")
        else:
            results.add_result("Multiple Messages Test", False, "Failed to verify updated count")
    else:
        results.add_result("Multiple Messages Test", False, f"Failed to send second message: {response}")
    
    # 10. Test reading messages (should decrease unread count)
    print("\n📖 BONUS TEST: Reading messages...")
    
    success, response = test_endpoint("GET", f"/chat/{alpay_username}", None, aslan_headers)
    if success:
        # Check unread count after reading
        success2, response2 = test_endpoint("GET", "/chat/unread-count", None, aslan_headers)
        if success2 and isinstance(response2, dict) and "unread_count" in response2:
            final_count = response2["unread_count"]
            if final_count == 0:
                results.add_result("Message Reading Test", True, "Unread count correctly reset to 0 after reading")
            else:
                results.add_result("Message Reading Test", False, f"Expected count 0 after reading, got {final_count}")
        else:
            results.add_result("Message Reading Test", False, "Failed to verify count after reading")
    else:
        results.add_result("Message Reading Test", False, f"Failed to read messages: {response}")
    
    print("\n" + "=" * 60)
    passed, failed = results.summary()
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED! Unread message endpoints are working correctly.")
    else:
        print(f"\n⚠️ {failed} test(s) failed. Please check the issues above.")
    
    return passed, failed

if __name__ == "__main__":
    main()