#!/usr/bin/env python3
"""
MindMatch Backend API Testing Suite
Tests all backend endpoints for the MindMatch application
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "https://syncmates.preview.emergentagent.com/api"

class MindMatchTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.tokens = {}  # Store tokens for different users
        self.users = {}   # Store user data
        self.games = {}   # Store game data
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def test_health_check(self) -> bool:
        """Test GET /api/health endpoint"""
        self.log("Testing Health Check endpoint...")
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log("✅ Health check passed")
                    return True
                else:
                    self.log(f"❌ Health check failed - unexpected response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Health check failed - status code: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Health check failed - exception: {str(e)}", "ERROR")
            return False
    
    def test_user_signup(self, username: str, password: str) -> bool:
        """Test user signup"""
        self.log(f"Testing user signup for {username}...")
        try:
            payload = {
                "username": username,
                "password": password,
                "bio": f"Test user {username}",
                "age": 25,
                "country": "TestLand"
            }
            
            response = self.session.post(f"{self.base_url}/auth/signup", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "username" in data:
                    self.tokens[username] = data["token"]
                    self.users[username] = data
                    self.log(f"✅ Signup successful for {username}")
                    return True
                else:
                    self.log(f"❌ Signup failed - missing token or username in response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Signup failed - status code: {response.status_code}, response: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Signup failed - exception: {str(e)}", "ERROR")
            return False
    
    def test_user_login(self, username: str, password: str) -> bool:
        """Test user login"""
        self.log(f"Testing user login for {username}...")
        try:
            payload = {
                "username": username,
                "password": password
            }
            
            response = self.session.post(f"{self.base_url}/auth/login", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "username" in data:
                    self.tokens[username] = data["token"]
                    self.log(f"✅ Login successful for {username}")
                    return True
                else:
                    self.log(f"❌ Login failed - missing token or username in response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Login failed - status code: {response.status_code}, response: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Login failed - exception: {str(e)}", "ERROR")
            return False
    
    def test_get_user_profile(self, username: str) -> bool:
        """Test getting user profile"""
        self.log(f"Testing get user profile for {username}...")
        try:
            if username not in self.tokens:
                self.log(f"❌ No token available for {username}", "ERROR")
                return False
                
            headers = {"Authorization": f"Bearer {self.tokens[username]}"}
            response = self.session.get(f"{self.base_url}/users/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["username", "bio", "xp", "level", "connection_score", "total_games"]
                if all(field in data for field in required_fields):
                    self.log(f"✅ Get user profile successful for {username}")
                    return True
                else:
                    self.log(f"❌ Get user profile failed - missing required fields: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get user profile failed - status code: {response.status_code}, response: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Get user profile failed - exception: {str(e)}", "ERROR")
            return False
    
    def test_get_online_users(self, username: str) -> bool:
        """Test getting online users"""
        self.log(f"Testing get online users for {username}...")
        try:
            if username not in self.tokens:
                self.log(f"❌ No token available for {username}", "ERROR")
                return False
                
            headers = {"Authorization": f"Bearer {self.tokens[username]}"}
            response = self.session.get(f"{self.base_url}/users/online", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log(f"✅ Get online users successful for {username} - found {len(data)} users")
                    return True
                else:
                    self.log(f"❌ Get online users failed - expected list, got: {type(data)}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get online users failed - status code: {response.status_code}, response: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Get online users failed - exception: {str(e)}", "ERROR")
            return False
    
    def test_create_ai_game(self, username: str) -> Optional[str]:
        """Test creating a game in AI mode"""
        self.log(f"Testing create AI game for {username}...")
        try:
            if username not in self.tokens:
                self.log(f"❌ No token available for {username}", "ERROR")
                return None
                
            headers = {"Authorization": f"Bearer {self.tokens[username]}"}
            payload = {"mode": "ai"}
            
            response = self.session.post(f"{self.base_url}/game/create", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "game_id" in data and "opponent" in data and data["opponent"] == "AI":
                    game_id = data["game_id"]
                    self.games[game_id] = data
                    self.log(f"✅ Create AI game successful for {username} - game_id: {game_id}")
                    return game_id
                else:
                    self.log(f"❌ Create AI game failed - missing game_id or opponent: {data}", "ERROR")
                    return None
            else:
                self.log(f"❌ Create AI game failed - status code: {response.status_code}, response: {response.text}", "ERROR")
                return None
        except Exception as e:
            self.log(f"❌ Create AI game failed - exception: {str(e)}", "ERROR")
            return None
    
    def test_submit_word(self, username: str, game_id: str, word: str) -> bool:
        """Test submitting a word in a game"""
        self.log(f"Testing submit word '{word}' for {username} in game {game_id}...")
        try:
            if username not in self.tokens:
                self.log(f"❌ No token available for {username}", "ERROR")
                return False
                
            headers = {"Authorization": f"Bearer {self.tokens[username]}"}
            payload = {"word": word}
            
            response = self.session.post(f"{self.base_url}/game/{game_id}/submit-word", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Submit word successful for {username} - response: {data}")
                return True
            else:
                self.log(f"❌ Submit word failed - status code: {response.status_code}, response: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Submit word failed - exception: {str(e)}", "ERROR")
            return False
    
    def test_get_game_status(self, username: str, game_id: str) -> bool:
        """Test getting game status"""
        self.log(f"Testing get game status for {username} in game {game_id}...")
        try:
            if username not in self.tokens:
                self.log(f"❌ No token available for {username}", "ERROR")
                return False
                
            headers = {"Authorization": f"Bearer {self.tokens[username]}"}
            response = self.session.get(f"{self.base_url}/game/{game_id}/status", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["game_id", "player1", "player2", "mode", "status", "current_round"]
                if all(field in data for field in required_fields):
                    self.log(f"✅ Get game status successful for {username}")
                    return True
                else:
                    self.log(f"❌ Get game status failed - missing required fields: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get game status failed - status code: {response.status_code}, response: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Get game status failed - exception: {str(e)}", "ERROR")
            return False
    
    def test_send_friend_request(self, from_username: str, to_username: str) -> bool:
        """Test sending friend request"""
        self.log(f"Testing send friend request from {from_username} to {to_username}...")
        try:
            if from_username not in self.tokens:
                self.log(f"❌ No token available for {from_username}", "ERROR")
                return False
                
            headers = {"Authorization": f"Bearer {self.tokens[from_username]}"}
            payload = {"to_username": to_username}
            
            response = self.session.post(f"{self.base_url}/friends/request", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log(f"✅ Send friend request successful from {from_username} to {to_username}")
                    return True
                else:
                    self.log(f"❌ Send friend request failed - unexpected response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Send friend request failed - status code: {response.status_code}, response: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Send friend request failed - exception: {str(e)}", "ERROR")
            return False
    
    def test_get_friend_requests(self, username: str) -> bool:
        """Test getting friend requests"""
        self.log(f"Testing get friend requests for {username}...")
        try:
            if username not in self.tokens:
                self.log(f"❌ No token available for {username}", "ERROR")
                return False
                
            headers = {"Authorization": f"Bearer {self.tokens[username]}"}
            response = self.session.get(f"{self.base_url}/friends/requests", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log(f"✅ Get friend requests successful for {username} - found {len(data)} requests")
                    return True
                else:
                    self.log(f"❌ Get friend requests failed - expected list, got: {type(data)}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get friend requests failed - status code: {response.status_code}, response: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Get friend requests failed - exception: {str(e)}", "ERROR")
            return False
    
    def test_accept_friend_request(self, username: str, from_username: str) -> bool:
        """Test accepting friend request"""
        self.log(f"Testing accept friend request for {username} from {from_username}...")
        try:
            if username not in self.tokens:
                self.log(f"❌ No token available for {username}", "ERROR")
                return False
                
            headers = {"Authorization": f"Bearer {self.tokens[username]}"}
            response = self.session.post(f"{self.base_url}/friends/accept/{from_username}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log(f"✅ Accept friend request successful for {username} from {from_username}")
                    return True
                else:
                    self.log(f"❌ Accept friend request failed - unexpected response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Accept friend request failed - status code: {response.status_code}, response: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Accept friend request failed - exception: {str(e)}", "ERROR")
            return False

def run_comprehensive_tests():
    """Run all backend tests"""
    tester = MindMatchTester()
    results = {}
    
    print("=" * 60)
    print("MINDMATCH BACKEND API TESTING")
    print("=" * 60)
    
    # 1. Health Check
    results["health_check"] = tester.test_health_check()
    
    # 2. Auth Flow - Signup and Login
    results["signup_testuser1"] = tester.test_user_signup("testuser1", "test123")
    results["login_testuser1"] = tester.test_user_login("testuser1", "test123")
    
    # 3. User Endpoints
    results["get_profile_testuser1"] = tester.test_get_user_profile("testuser1")
    results["get_online_users"] = tester.test_get_online_users("testuser1")
    
    # 4. Game Flow (AI Mode)
    game_id = tester.test_create_ai_game("testuser1")
    if game_id:
        results["create_ai_game"] = True
        results["submit_word_round1"] = tester.test_submit_word("testuser1", game_id, "OCEAN")
        results["get_game_status"] = tester.test_get_game_status("testuser1", game_id)
    else:
        results["create_ai_game"] = False
        results["submit_word_round1"] = False
        results["get_game_status"] = False
    
    # 5. Friend System
    results["signup_testuser2"] = tester.test_user_signup("testuser2", "test123")
    if results["signup_testuser2"]:
        results["send_friend_request"] = tester.test_send_friend_request("testuser1", "testuser2")
        results["get_friend_requests"] = tester.test_get_friend_requests("testuser2")
        results["accept_friend_request"] = tester.test_accept_friend_request("testuser2", "testuser1")
    else:
        results["send_friend_request"] = False
        results["get_friend_requests"] = False
        results["accept_friend_request"] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:<25}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed!")
        return True
    else:
        print("⚠️  Some tests failed - check logs above for details")
        return False

if __name__ == "__main__":
    success = run_comprehensive_tests()
    exit(0 if success else 1)