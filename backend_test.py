#!/usr/bin/env python3
"""
Backend API Testing for MindMatch Chat Conversations
Testing the specific issue where chat conversations endpoint returns empty despite friendships existing
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from frontend env
BACKEND_URL = "https://syncmates.preview.emergentagent.com/api"

class ChatConversationsTest:
    def __init__(self):
        self.token = None
        self.username = None
        self.session = requests.Session()
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_login(self, username="player1", password="test123"):
        """Test login and get token"""
        self.log(f"Testing login for {username}")
        
        url = f"{BACKEND_URL}/auth/login"
        data = {"username": username, "password": password}
        
        try:
            response = self.session.post(url, json=data)
            self.log(f"Login response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                self.token = result.get("token")
                self.username = result.get("username")
                self.log(f"✅ Login successful for {self.username}")
                self.log(f"Token: {self.token[:20]}..." if self.token else "No token received")
                return True
            else:
                self.log(f"❌ Login failed: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Login error: {str(e)}", "ERROR")
            return False
    
    def get_headers(self):
        """Get authorization headers"""
        if not self.token:
            return {}
        return {"Authorization": f"Bearer {self.token}"}
    
    def test_friends_list(self):
        """Test friends list to verify friendships exist"""
        self.log("Testing friends list endpoint")
        
        url = f"{BACKEND_URL}/friends/list"
        headers = self.get_headers()
        
        try:
            response = self.session.get(url, headers=headers)
            self.log(f"Friends list response status: {response.status_code}")
            
            if response.status_code == 200:
                friends = response.json()
                self.log(f"✅ Friends list retrieved: {len(friends)} friends")
                for friend in friends:
                    self.log(f"  - {friend.get('username')} (online: {friend.get('online', False)})")
                return friends
            else:
                self.log(f"❌ Friends list failed: {response.text}", "ERROR")
                return []
                
        except Exception as e:
            self.log(f"❌ Friends list error: {str(e)}", "ERROR")
            return []
    
    def test_conversations_endpoint(self):
        """Test the main conversations endpoint - this is the failing one"""
        self.log("Testing conversations endpoint (MAIN TEST)")
        
        url = f"{BACKEND_URL}/chat/conversations"
        headers = self.get_headers()
        
        try:
            response = self.session.get(url, headers=headers)
            self.log(f"Conversations response status: {response.status_code}")
            self.log(f"Response headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                conversations = response.json()
                self.log(f"Conversations response: {json.dumps(conversations, indent=2)}")
                
                if len(conversations) == 0:
                    self.log("❌ PROBLEM FOUND: Conversations endpoint returns empty array!", "ERROR")
                    return False
                else:
                    self.log(f"✅ Conversations retrieved: {len(conversations)} conversations")
                    for conv in conversations:
                        self.log(f"  - {conv.get('username')} | Last: '{conv.get('last_message', 'No messages')}'")
                    return True
            else:
                self.log(f"❌ Conversations failed: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Conversations error: {str(e)}", "ERROR")
            return False
    
    def test_conversations_debug(self):
        """Test the debug endpoint to see raw friendship data"""
        self.log("Testing conversations debug endpoint")
        
        url = f"{BACKEND_URL}/chat/test"
        headers = self.get_headers()
        
        try:
            response = self.session.get(url, headers=headers)
            self.log(f"Debug response status: {response.status_code}")
            
            if response.status_code == 200:
                debug_data = response.json()
                self.log(f"Debug data: {json.dumps(debug_data, indent=2)}")
                
                # Additional debugging - check if it's returning the expected structure
                if isinstance(debug_data, dict):
                    self.log(f"Current user from debug: {debug_data.get('current_user')}")
                    self.log(f"Friendships count: {debug_data.get('friendships_count')}")
                    self.log(f"Friendships: {debug_data.get('friendships')}")
                else:
                    self.log(f"❌ Debug endpoint returned unexpected type: {type(debug_data)}", "ERROR")
                
                return debug_data
            else:
                self.log(f"❌ Debug failed: {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Debug error: {str(e)}", "ERROR")
            return None
    
    def test_chat_with_friend(self, friend_username):
        """Test chat history with a specific friend"""
        self.log(f"Testing chat history with {friend_username}")
        
        url = f"{BACKEND_URL}/chat/{friend_username}"
        headers = self.get_headers()
        
        try:
            response = self.session.get(url, headers=headers)
            self.log(f"Chat history response status: {response.status_code}")
            
            if response.status_code == 200:
                messages = response.json()
                self.log(f"✅ Chat history retrieved: {len(messages)} messages")
                if messages:
                    self.log(f"Latest message: {messages[-1].get('message', 'No message')}")
                return messages
            else:
                self.log(f"❌ Chat history failed: {response.text}", "ERROR")
                return []
                
        except Exception as e:
            self.log(f"❌ Chat history error: {str(e)}", "ERROR")
            return []
    
    def run_full_test(self):
        """Run the complete test suite for chat conversations"""
        self.log("=" * 60)
        self.log("STARTING CHAT CONVERSATIONS ENDPOINT TESTING")
        self.log("=" * 60)
        
        # Step 1: Login
        if not self.test_login():
            self.log("❌ Cannot proceed without login", "ERROR")
            return False
        
        # Step 2: Check friends list
        friends = self.test_friends_list()
        
        # Step 3: Test debug endpoint
        debug_data = self.test_conversations_debug()
        
        # Step 4: Test main conversations endpoint
        conversations_working = self.test_conversations_endpoint()
        
        # Step 5: Test chat with each friend if any exist
        if friends:
            for friend in friends:
                self.test_chat_with_friend(friend.get('username'))
        
        self.log("=" * 60)
        if conversations_working:
            self.log("✅ CONVERSATIONS ENDPOINT WORKING")
        else:
            self.log("❌ CONVERSATIONS ENDPOINT FAILING - NEEDS INVESTIGATION")
        self.log("=" * 60)
        
        return conversations_working

def main():
    """Main test execution"""
    tester = ChatConversationsTest()
    success = tester.run_full_test()
    
    if not success:
        print("\n🔍 DEBUGGING SUGGESTIONS:")
        print("1. Check if friendships exist in database")
        print("2. Verify friendship status is 'accepted'")
        print("3. Check if users collection has the friend users")
        print("4. Verify the MongoDB query in conversations endpoint")
        print("5. Check for any database connection issues")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()