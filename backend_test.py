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
        self.user1_token = None
        self.user2_token = None
        self.user1_username = "inviter_alice"
        self.user2_username = "invitee_bob"
        self.user1_password = "secure123"
        self.user2_password = "secure456"
        self.invite_id = None
        self.game_id = None
        
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