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
        
        # Check for unread messages from alpay to aslan
        unread_messages = await chats_collection.find({
            "from_username": "alpay",
            "to_username": "aslan", 
            "read": False
        }).to_list(100)
        
        client.close()
        
        if len(unread_messages) > 0:
            results.add_result("MongoDB Verification", True, f"Found {len(unread_messages)} unread messages from alpay to aslan")
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
    
    # Try signup first
    alpay_data = {
        "username": "alpay",
        "password": "alpay123",
        "bio": "Test user alpay",
        "age": 25,
        "country": "Turkey"
    }
    
    success, response = test_endpoint("POST", "/auth/signup", alpay_data, expected_status=200)
    if not success:
        # User might exist, try login
        login_data = {"username": "alpay", "password": "alpay123"}
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
        "username": "aslan",
        "password": "aslan123", 
        "bio": "Test user aslan",
        "age": 28,
        "country": "Turkey"
    }
    
    success, response = test_endpoint("POST", "/auth/signup", aslan_data, expected_status=200)
    if not success:
        # User might exist, try login
        login_data = {"username": "aslan", "password": "aslan123"}
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
    friend_request = {"to_username": "aslan"}
    success, response = test_endpoint("POST", "/friends/request", friend_request, alpay_headers)
    if not success and "already exists" not in str(response):
        results.add_result("Friend Request", False, f"Failed to send friend request: {response}")
        return
    
    # Aslan accepts friend request from alpay
    success, response = test_endpoint("POST", "/friends/accept/alpay", None, aslan_headers)
    if success or "already" in str(response).lower():
        results.add_result("Friendship Established", True, "alpay and aslan are now friends")
    else:
        results.add_result("Friendship Established", False, f"Failed to establish friendship: {response}")
        return
    
    # 5. TEST 1: POST /api/chat/send - Alpay sends message to Aslan
    print("\n💬 TEST 1: Sending message from alpay to aslan...")
    
    message_data = {
        "to_username": "aslan",
        "message": "Hello Aslan!"
    }
    
    success, response = test_endpoint("POST", "/chat/send", message_data, alpay_headers)
    if success:
        results.add_result("Send Message (alpay → aslan)", True, "Message sent successfully")
    else:
        results.add_result("Send Message (alpay → aslan)", False, f"Failed to send message: {response}")
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
        if "alpay" in response and response["alpay"] > 0:
            results.add_result("Unread By User Endpoint", True, f"Found {response['alpay']} unread messages from alpay")
        else:
            results.add_result("Unread By User Endpoint", False, f"No unread messages from alpay found: {response}")
    else:
        results.add_result("Unread By User Endpoint", False, f"Failed to get unread by user: {response}")
    
    # 8. TEST 4: Verify MongoDB data
    print("\n🗄️ TEST 4: Verifying MongoDB data...")
    
    # Run async MongoDB verification
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(verify_mongodb_data())
    loop.close()
    
    # 9. Additional test: Send another message and verify counts increase
    print("\n📈 BONUS TEST: Sending second message...")
    
    message_data2 = {
        "to_username": "aslan", 
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
    
    success, response = test_endpoint("GET", "/chat/alpay", None, aslan_headers)
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
        
    def log(self, message):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def test_health_check(self):
        """Test health endpoint"""
        self.log("🔍 Testing health check...")
        try:
            response = requests.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                self.log("✅ Health check passed")
                return True
            else:
                self.log(f"❌ Health check failed: {response.status_code}")
                return False
        except Exception as e:
            self.log(f"❌ Health check error: {e}")
            return False
    
    def setup_test_users(self):
        """Create and authenticate test users"""
        self.log("🔍 Setting up test users...")
        
        # Create User 1
        user1_data = {
            "username": self.user1_username,
            "password": self.user1_password,
            "bio": "Game invitation tester - Alice",
            "age": 25,
            "country": "TestLand"
        }
        
        # Try signup first, if fails try login
        response = requests.post(f"{BASE_URL}/auth/signup", json=user1_data, headers=HEADERS)
        if response.status_code == 200:
            self.user1_token = response.json()["token"]
            self.log(f"✅ User1 ({self.user1_username}) created and authenticated")
        elif response.status_code == 400 and "already exists" in response.json().get("detail", ""):
            # User exists, try login
            login_data = {"username": self.user1_username, "password": self.user1_password}
            response = requests.post(f"{BASE_URL}/auth/login", json=login_data, headers=HEADERS)
            if response.status_code == 200:
                self.user1_token = response.json()["token"]
                self.log(f"✅ User1 ({self.user1_username}) logged in")
            else:
                self.log(f"❌ User1 login failed: {response.status_code} - {response.text}")
                return False
        else:
            self.log(f"❌ User1 creation failed: {response.status_code} - {response.text}")
            return False
        
        # Create User 2
        user2_data = {
            "username": self.user2_username,
            "password": self.user2_password,
            "bio": "Game invitation tester - Bob",
            "age": 28,
            "country": "TestLand"
        }
        
        response = requests.post(f"{BASE_URL}/auth/signup", json=user2_data, headers=HEADERS)
        if response.status_code == 200:
            self.user2_token = response.json()["token"]
            self.log(f"✅ User2 ({self.user2_username}) created and authenticated")
        elif response.status_code == 400 and "already exists" in response.json().get("detail", ""):
            # User exists, try login
            login_data = {"username": self.user2_username, "password": self.user2_password}
            response = requests.post(f"{BASE_URL}/auth/login", json=login_data, headers=HEADERS)
            if response.status_code == 200:
                self.user2_token = response.json()["token"]
                self.log(f"✅ User2 ({self.user2_username}) logged in")
            else:
                self.log(f"❌ User2 login failed: {response.status_code} - {response.text}")
                return False
        else:
            self.log(f"❌ User2 creation failed: {response.status_code} - {response.text}")
            return False
        
        return True
    
    def establish_friendship(self):
        """Make the two users friends"""
        self.log("🔍 Establishing friendship...")
        
        # User1 sends friend request to User2
        headers_user1 = {**HEADERS, "Authorization": f"Bearer {self.user1_token}"}
        friend_request = {"to_username": self.user2_username}
        
        response = requests.post(f"{BASE_URL}/friends/request", json=friend_request, headers=headers_user1)
        if response.status_code == 200:
            self.log("✅ Friend request sent")
        elif response.status_code == 400 and "already exists" in response.json().get("detail", ""):
            self.log("ℹ️ Friend request already exists")
        else:
            self.log(f"❌ Friend request failed: {response.status_code} - {response.text}")
            return False
        
        # User2 accepts friend request
        headers_user2 = {**HEADERS, "Authorization": f"Bearer {self.user2_token}"}
        response = requests.post(f"{BASE_URL}/friends/accept/{self.user1_username}", headers=headers_user2)
        if response.status_code == 200:
            self.log("✅ Friend request accepted")
            return True
        else:
            self.log(f"❌ Friend request acceptance failed: {response.status_code} - {response.text}")
            return False
    
    def test_send_game_invite(self):
        """Test POST /api/game/invite - Send game invitation"""
        self.log("🔍 Testing send game invite...")
        
        headers_user1 = {**HEADERS, "Authorization": f"Bearer {self.user1_token}"}
        invite_data = {"to_username": self.user2_username}
        
        response = requests.post(f"{BASE_URL}/game/invite", json=invite_data, headers=headers_user1)
        
        if response.status_code == 200:
            result = response.json()
            self.invite_id = result.get("invite_id")
            self.log(f"✅ Game invite sent successfully. Invite ID: {self.invite_id}")
            return True
        else:
            self.log(f"❌ Send game invite failed: {response.status_code} - {response.text}")
            return False
    
    def test_send_invite_to_non_friend(self):
        """Test error when trying to invite non-friend"""
        self.log("🔍 Testing invite to non-friend (should fail)...")
        
        # Create a third user who is not a friend
        non_friend_data = {
            "username": "non_friend_charlie",
            "password": "secure789",
            "bio": "Not a friend"
        }
        
        # Try to create non-friend user
        response = requests.post(f"{BASE_URL}/auth/signup", json=non_friend_data, headers=HEADERS)
        if response.status_code != 200 and response.status_code != 400:
            self.log(f"❌ Could not create non-friend user: {response.status_code}")
            return False
        
        # Try to invite non-friend
        headers_user1 = {**HEADERS, "Authorization": f"Bearer {self.user1_token}"}
        invite_data = {"to_username": "non_friend_charlie"}
        
        response = requests.post(f"{BASE_URL}/game/invite", json=invite_data, headers=headers_user1)
        
        if response.status_code == 403:
            self.log("✅ Correctly rejected invite to non-friend")
            return True
        else:
            self.log(f"❌ Should have rejected non-friend invite: {response.status_code} - {response.text}")
            return False
    
    def test_duplicate_invite(self):
        """Test error when duplicate invite exists"""
        self.log("🔍 Testing duplicate invite (should fail)...")
        
        headers_user1 = {**HEADERS, "Authorization": f"Bearer {self.user1_token}"}
        invite_data = {"to_username": self.user2_username}
        
        response = requests.post(f"{BASE_URL}/game/invite", json=invite_data, headers=headers_user1)
        
        if response.status_code == 400:
            self.log("✅ Correctly rejected duplicate invite")
            return True
        else:
            self.log(f"❌ Should have rejected duplicate invite: {response.status_code} - {response.text}")
            return False
    
    def test_get_game_invites(self):
        """Test GET /api/game/invites - Get pending invites"""
        self.log("🔍 Testing get game invites...")
        
        headers_user2 = {**HEADERS, "Authorization": f"Bearer {self.user2_token}"}
        
        response = requests.get(f"{BASE_URL}/game/invites", headers=headers_user2)
        
        if response.status_code == 200:
            invites = response.json()
            self.log(f"✅ Retrieved {len(invites)} pending invites")
            
            # Verify invite structure
            if len(invites) > 0:
                invite = invites[0]
                required_fields = ["invite_id", "from_username", "to_username", "status", 
                                 "from_user_avatar", "from_user_level", "created_at"]
                
                missing_fields = [field for field in required_fields if field not in invite]
                if missing_fields:
                    self.log(f"❌ Missing fields in invite response: {missing_fields}")
                    return False
                
                # Verify values
                if invite["from_username"] != self.user1_username:
                    self.log(f"❌ Wrong from_username: {invite['from_username']}")
                    return False
                
                if invite["to_username"] != self.user2_username:
                    self.log(f"❌ Wrong to_username: {invite['to_username']}")
                    return False
                
                if invite["status"] != "pending":
                    self.log(f"❌ Wrong status: {invite['status']}")
                    return False
                
                self.log("✅ Invite structure and values are correct")
                return True
            else:
                self.log("❌ No invites found, but one should exist")
                return False
        else:
            self.log(f"❌ Get invites failed: {response.status_code} - {response.text}")
            return False
    
    def test_accept_game_invite(self):
        """Test POST /api/game/invite/{invite_id}/accept - Accept invitation"""
        self.log("🔍 Testing accept game invite...")
        
        if not self.invite_id:
            self.log("❌ No invite_id available for acceptance test")
            return False
        
        headers_user2 = {**HEADERS, "Authorization": f"Bearer {self.user2_token}"}
        
        response = requests.post(f"{BASE_URL}/game/invite/{self.invite_id}/accept", headers=headers_user2)
        
        if response.status_code == 200:
            result = response.json()
            self.game_id = result.get("game_id")
            opponent = result.get("opponent")
            
            if not self.game_id:
                self.log("❌ No game_id in accept response")
                return False
            
            if opponent != self.user1_username:
                self.log(f"❌ Wrong opponent: {opponent}")
                return False
            
            self.log(f"✅ Game invite accepted. Game ID: {self.game_id}, Opponent: {opponent}")
            return True
        else:
            self.log(f"❌ Accept invite failed: {response.status_code} - {response.text}")
            return False
    
    def test_accept_nonexistent_invite(self):
        """Test error when accepting non-existent invite"""
        self.log("🔍 Testing accept non-existent invite (should fail)...")
        
        headers_user2 = {**HEADERS, "Authorization": f"Bearer {self.user2_token}"}
        fake_invite_id = "nonexistent_invite_id"
        
        response = requests.post(f"{BASE_URL}/game/invite/{fake_invite_id}/accept", headers=headers_user2)
        
        if response.status_code == 404:
            self.log("✅ Correctly rejected non-existent invite")
            return True
        else:
            self.log(f"❌ Should have rejected non-existent invite: {response.status_code} - {response.text}")
            return False
    
    def test_accept_already_processed_invite(self):
        """Test error when accepting already processed invite"""
        self.log("🔍 Testing accept already processed invite (should fail)...")
        
        if not self.invite_id:
            self.log("❌ No invite_id available for this test")
            return False
        
        headers_user2 = {**HEADERS, "Authorization": f"Bearer {self.user2_token}"}
        
        response = requests.post(f"{BASE_URL}/game/invite/{self.invite_id}/accept", headers=headers_user2)
        
        if response.status_code == 400:
            self.log("✅ Correctly rejected already processed invite")
            return True
        else:
            self.log(f"❌ Should have rejected already processed invite: {response.status_code} - {response.text}")
            return False
    
    def test_decline_game_invite(self):
        """Test POST /api/game/invite/{invite_id}/decline - Decline invitation"""
        self.log("🔍 Testing decline game invite...")
        
        # First, create a new invite to decline
        headers_user1 = {**HEADERS, "Authorization": f"Bearer {self.user1_token}"}
        invite_data = {"to_username": self.user2_username}
        
        response = requests.post(f"{BASE_URL}/game/invite", json=invite_data, headers=headers_user1)
        if response.status_code != 200:
            self.log(f"❌ Could not create invite for decline test: {response.status_code}")
            return False
        
        decline_invite_id = response.json().get("invite_id")
        
        # Now decline it
        headers_user2 = {**HEADERS, "Authorization": f"Bearer {self.user2_token}"}
        
        response = requests.post(f"{BASE_URL}/game/invite/{decline_invite_id}/decline", headers=headers_user2)
        
        if response.status_code == 200:
            self.log("✅ Game invite declined successfully")
            return True
        else:
            self.log(f"❌ Decline invite failed: {response.status_code} - {response.text}")
            return False
    
    def test_verify_game_creation(self):
        """Verify both users can access the created game"""
        self.log("🔍 Testing game creation verification...")
        
        if not self.game_id:
            self.log("❌ No game_id available for verification")
            return False
        
        # Test User1 can access game
        headers_user1 = {**HEADERS, "Authorization": f"Bearer {self.user1_token}"}
        response = requests.get(f"{BASE_URL}/game/{self.game_id}/status", headers=headers_user1)
        
        if response.status_code != 200:
            self.log(f"❌ User1 cannot access game: {response.status_code} - {response.text}")
            return False
        
        game_data = response.json()
        
        # Verify game properties
        if game_data.get("player1") != self.user1_username:
            self.log(f"❌ Wrong player1: {game_data.get('player1')}")
            return False
        
        if game_data.get("player2") != self.user2_username:
            self.log(f"❌ Wrong player2: {game_data.get('player2')}")
            return False
        
        if game_data.get("mode") != "friend":
            self.log(f"❌ Wrong mode: {game_data.get('mode')}")
            return False
        
        # Test User2 can access game
        headers_user2 = {**HEADERS, "Authorization": f"Bearer {self.user2_token}"}
        response = requests.get(f"{BASE_URL}/game/{self.game_id}/status", headers=headers_user2)
        
        if response.status_code != 200:
            self.log(f"❌ User2 cannot access game: {response.status_code} - {response.text}")
            return False
        
        self.log("✅ Both users can access the created game with correct properties")
        return True
    
    def run_all_tests(self):
        """Run the complete test suite"""
        self.log("🚀 Starting Game Invitation System Test Suite")
        self.log("=" * 60)
        
        tests = [
            ("Health Check", self.test_health_check),
            ("Setup Test Users", self.setup_test_users),
            ("Establish Friendship", self.establish_friendship),
            ("Send Game Invite", self.test_send_game_invite),
            ("Send Invite to Non-Friend", self.test_send_invite_to_non_friend),
            ("Duplicate Invite", self.test_duplicate_invite),
            ("Get Game Invites", self.test_get_game_invites),
            ("Accept Game Invite", self.test_accept_game_invite),
            ("Accept Non-existent Invite", self.test_accept_nonexistent_invite),
            ("Accept Already Processed Invite", self.test_accept_already_processed_invite),
            ("Decline Game Invite", self.test_decline_game_invite),
            ("Verify Game Creation", self.test_verify_game_creation)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            self.log(f"\n--- {test_name} ---")
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                self.log(f"❌ {test_name} crashed: {e}")
                failed += 1
            
            time.sleep(0.5)  # Small delay between tests
        
        self.log("\n" + "=" * 60)
        self.log(f"🏁 Test Suite Complete: {passed} passed, {failed} failed")
        self.log(f"📊 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        return failed == 0

if __name__ == "__main__":
    test_suite = GameInviteTestSuite()
    success = test_suite.run_all_tests()
    exit(0 if success else 1)