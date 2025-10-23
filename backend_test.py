#!/usr/bin/env python3
"""
Friend Mode Game Flow Testing
Testing the specific issue where two users play friend mode but game gets stuck in "waiting" state
"""

import requests
import json
import time
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://syncmates.preview.emergentagent.com/api"

class FriendGameFlowTester:
    def __init__(self):
        self.user1_token = None
        self.user2_token = None
        self.user1_username = f"testuser1_{int(time.time())}"
        self.user2_username = f"testuser2_{int(time.time())}"
        self.game_id = None
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def test_signup_users(self):
        """Create two test users"""
        self.log("🔧 Creating test users...")
        
        # User 1
        user1_data = {
            "username": self.user1_username,
            "password": "testpass123",
            "bio": "Test user 1 for friend game flow",
            "age": 25,
            "country": "Test Country"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/signup", json=user1_data)
        if response.status_code == 200:
            self.user1_token = response.json()["token"]
            self.log(f"✅ User1 created: {self.user1_username}")
        else:
            self.log(f"❌ User1 signup failed: {response.status_code} - {response.text}")
            return False
            
        # User 2
        user2_data = {
            "username": self.user2_username,
            "password": "testpass123",
            "bio": "Test user 2 for friend game flow",
            "age": 27,
            "country": "Test Country"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/signup", json=user2_data)
        if response.status_code == 200:
            self.user2_token = response.json()["token"]
            self.log(f"✅ User2 created: {self.user2_username}")
            return True
        else:
            self.log(f"❌ User2 signup failed: {response.status_code} - {response.text}")
            return False
    
    def test_create_friendship(self):
        """Create friendship between users"""
        self.log("🤝 Creating friendship...")
        
        # User1 sends friend request to User2
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        request_data = {"to_username": self.user2_username}
        
        response = requests.post(f"{BACKEND_URL}/friends/request", json=request_data, headers=headers)
        if response.status_code != 200:
            self.log(f"❌ Friend request failed: {response.status_code} - {response.text}")
            return False
        
        self.log(f"✅ Friend request sent from {self.user1_username} to {self.user2_username}")
        
        # User2 accepts friend request
        headers = {"Authorization": f"Bearer {self.user2_token}"}
        response = requests.post(f"{BACKEND_URL}/friends/accept/{self.user1_username}", headers=headers)
        if response.status_code != 200:
            self.log(f"❌ Friend accept failed: {response.status_code} - {response.text}")
            return False
            
        self.log(f"✅ Friendship established between {self.user1_username} and {self.user2_username}")
        return True
    
    def test_create_friend_game(self):
        """Create friend mode game"""
        self.log("🎮 Creating friend mode game...")
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        game_data = {
            "mode": "friend",
            "opponent_username": self.user2_username
        }
        
        response = requests.post(f"{BACKEND_URL}/game/create", json=game_data, headers=headers)
        if response.status_code != 200:
            self.log(f"❌ Game creation failed: {response.status_code} - {response.text}")
            return False
            
        result = response.json()
        self.game_id = result["game_id"]
        self.log(f"✅ Friend game created: {self.game_id}")
        self.log(f"   Player1: {self.user1_username}")
        self.log(f"   Player2: {self.user2_username}")
        return True
    
    def test_game_status(self, expected_round=None):
        """Check game status"""
        self.log("📊 Checking game status...")
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        response = requests.get(f"{BACKEND_URL}/game/{self.game_id}/status", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ Game status failed: {response.status_code} - {response.text}")
            return None
            
        status = response.json()
        self.log(f"   Game ID: {status['game_id']}")
        self.log(f"   Status: {status['status']}")
        self.log(f"   Current Round: {status['current_round']}")
        self.log(f"   Player1 Word: {status.get('player1_word', 'None')}")
        self.log(f"   Player2 Word: {status.get('player2_word', 'None')}")
        self.log(f"   Synced: {status.get('synced', False)}")
        
        if expected_round and status['current_round'] != expected_round:
            self.log(f"❌ Expected round {expected_round}, got {status['current_round']}")
            return None
            
        return status
    
    def test_submit_word(self, user_token, username, word, expected_response_type=None):
        """Submit word for a user"""
        self.log(f"📝 {username} submitting word: {word}")
        
        headers = {"Authorization": f"Bearer {user_token}"}
        word_data = {"word": word}
        
        response = requests.post(f"{BACKEND_URL}/game/{self.game_id}/submit-word", json=word_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ Word submission failed for {username}: {response.status_code} - {response.text}")
            return None
            
        result = response.json()
        self.log(f"   Response: {result}")
        
        if expected_response_type:
            if expected_response_type == "waiting" and "waiting" not in result:
                self.log(f"❌ Expected 'waiting' response, got: {result}")
                return None
            elif expected_response_type == "next_round" and "next_round" not in result:
                self.log(f"❌ Expected 'next_round' response, got: {result}")
                return None
            elif expected_response_type == "synced" and not result.get("synced"):
                self.log(f"❌ Expected 'synced' response, got: {result}")
                return None
        
        return result
    
    def test_round_1_flow(self):
        """Test Round 1: Both users submit different words"""
        self.log("🎯 Testing Round 1 Flow...")
        
        # Check initial game status
        status = self.test_game_status(expected_round=1)
        if not status:
            return False
            
        # User1 submits first word
        result1 = self.test_submit_word(self.user1_token, self.user1_username, "WATER", "waiting")
        if not result1 or "waiting" not in result1:
            self.log("❌ User1 should get 'waiting' response")
            return False
            
        # Check game status after first word
        status = self.test_game_status()
        if not status:
            return False
            
        # User2 submits second word
        result2 = self.test_submit_word(self.user2_token, self.user2_username, "OCEAN", "next_round")
        if not result2:
            return False
            
        # Check if we got next_round response
        if "next_round" in result2:
            self.log(f"✅ Round 1 completed, moving to round {result2['next_round']}")
            return True
        elif result2.get("synced"):
            self.log(f"✅ Unexpected SYNC in round 1 with words WATER and OCEAN")
            return True
        else:
            self.log(f"❌ Unexpected response after both words submitted: {result2}")
            return False
    
    def test_round_2_flow(self):
        """Test Round 2: Both users submit different words"""
        self.log("🎯 Testing Round 2 Flow...")
        
        # Check game status should be round 2
        status = self.test_game_status(expected_round=2)
        if not status:
            return False
            
        # User1 submits word for round 2
        result1 = self.test_submit_word(self.user1_token, self.user1_username, "RAIN", "waiting")
        if not result1 or "waiting" not in result1:
            self.log("❌ User1 should get 'waiting' response in round 2")
            return False
            
        # User2 submits word for round 2
        result2 = self.test_submit_word(self.user2_token, self.user2_username, "STORM", "next_round")
        if not result2:
            return False
            
        # Check response
        if "next_round" in result2:
            self.log(f"✅ Round 2 completed, moving to round {result2['next_round']}")
            return True
        elif result2.get("synced"):
            self.log(f"✅ Unexpected SYNC in round 2 with words RAIN and STORM")
            return True
        else:
            self.log(f"❌ Unexpected response in round 2: {result2}")
            return False
    
    def test_sync_scenario(self):
        """Test SYNC scenario: Both users submit same word"""
        self.log("🎯 Testing SYNC Scenario...")
        
        # Check current round
        status = self.test_game_status()
        if not status:
            return False
            
        current_round = status['current_round']
        self.log(f"Testing SYNC in round {current_round}")
        
        # Both users submit same word
        result1 = self.test_submit_word(self.user1_token, self.user1_username, "WEATHER", "waiting")
        if not result1 or "waiting" not in result1:
            self.log("❌ User1 should get 'waiting' response")
            return False
            
        result2 = self.test_submit_word(self.user2_token, self.user2_username, "WEATHER", "synced")
        if not result2:
            return False
            
        # Check if SYNC achieved
        if result2.get("synced"):
            self.log(f"✅ SYNC achieved with word: {result2.get('sync_word')}")
            self.log(f"   Rounds taken: {result2.get('rounds')}")
            self.log(f"   Wavelength score: {result2.get('wavelength_score')}")
            return True
        else:
            self.log(f"❌ Expected SYNC but got: {result2}")
            return False
    
    def run_full_test(self):
        """Run complete friend game flow test"""
        self.log("🚀 Starting Friend Mode Game Flow Test")
        self.log("=" * 60)
        
        # Step 1: Create users
        if not self.test_signup_users():
            self.log("❌ FAILED: User creation")
            return False
            
        # Step 2: Create friendship
        if not self.test_create_friendship():
            self.log("❌ FAILED: Friendship creation")
            return False
            
        # Step 3: Create friend game
        if not self.test_create_friend_game():
            self.log("❌ FAILED: Game creation")
            return False
            
        # Step 4: Test Round 1
        if not self.test_round_1_flow():
            self.log("❌ FAILED: Round 1 flow")
            return False
            
        # Step 5: Test Round 2
        if not self.test_round_2_flow():
            self.log("❌ FAILED: Round 2 flow")
            return False
            
        # Step 6: Test SYNC scenario
        if not self.test_sync_scenario():
            self.log("❌ FAILED: SYNC scenario")
            return False
            
        self.log("=" * 60)
        self.log("✅ ALL TESTS PASSED: Friend Mode Game Flow Working Correctly")
        return True

def main():
    """Main test function"""
    tester = FriendGameFlowTester()
    success = tester.run_full_test()
    
    if not success:
        print("\n❌ FRIEND GAME FLOW TEST FAILED")
        print("The issue with games getting stuck in 'waiting' state has been identified.")
        exit(1)
    else:
        print("\n✅ FRIEND GAME FLOW TEST PASSED")
        print("Friend mode games are working correctly.")
        exit(0)

if __name__ == "__main__":
    main()