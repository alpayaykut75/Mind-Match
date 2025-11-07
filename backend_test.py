#!/usr/bin/env python3
"""
Backend API Testing Script for MindMatch App
Tests Username Change and Password Change endpoints
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BASE_URL = "https://friend-sync-1.preview.emergentagent.com/api"

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "tests": []
}

def log_test(test_name, passed, message=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if message:
        print(f"   {message}")
    
    test_results["tests"].append({
        "name": test_name,
        "passed": passed,
        "message": message
    })
    
    if passed:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1


def print_summary():
    """Print test summary"""
    total = test_results["passed"] + test_results["failed"]
    print("\n" + "="*70)
    print(f"TEST SUMMARY: {test_results['passed']}/{total} tests passed")
    print("="*70)
    
    if test_results["failed"] > 0:
        print("\nFailed Tests:")
        for test in test_results["tests"]:
            if not test["passed"]:
                print(f"  ❌ {test['name']}")
                if test["message"]:
                    print(f"     {test['message']}")


# ============ USERNAME CHANGE TESTS ============

def test_username_change():
    """Test username change endpoint"""
    print("\n" + "="*70)
    print("TESTING: Username Change Endpoint")
    print("="*70)
    
    # Test 1: Create test user
    test_username = f"testuser_{datetime.now().timestamp()}"
    test_password = "testpass123"
    
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json={
            "username": test_username,
            "password": test_password,
            "bio": "Test user for username change",
            "age": 25,
            "country": "USA"
        })
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            log_test("Create test user for username change", True, f"User: {test_username}")
        else:
            log_test("Create test user for username change", False, f"Status: {response.status_code}, Response: {response.text}")
            return
    except Exception as e:
        log_test("Create test user for username change", False, f"Error: {str(e)}")
        return
    
    # Test 2: Change username successfully
    new_username = f"newuser_{datetime.now().timestamp()}"
    
    try:
        response = requests.put(
            f"{BASE_URL}/users/change-username",
            json={"new_username": new_username},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            new_token = data.get("token")
            returned_username = data.get("username")
            
            if new_token and returned_username == new_username:
                log_test("Change username successfully", True, f"Old: {test_username} → New: {new_username}")
                token = new_token  # Update token for subsequent tests
            else:
                log_test("Change username successfully", False, f"Missing token or username mismatch. Response: {data}")
                return
        else:
            log_test("Change username successfully", False, f"Status: {response.status_code}, Response: {response.text}")
            return
    except Exception as e:
        log_test("Change username successfully", False, f"Error: {str(e)}")
        return
    
    # Test 3: Verify can login with new username
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "username": new_username,
            "password": test_password
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get("token"):
                log_test("Login with new username", True, f"Successfully logged in as {new_username}")
            else:
                log_test("Login with new username", False, "No token returned")
        else:
            log_test("Login with new username", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("Login with new username", False, f"Error: {str(e)}")
    
    # Test 4: Verify old username doesn't work
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "username": test_username,
            "password": test_password
        })
        
        if response.status_code == 401:
            log_test("Old username rejected", True, f"Old username {test_username} correctly rejected")
        else:
            log_test("Old username rejected", False, f"Old username still works! Status: {response.status_code}")
    except Exception as e:
        log_test("Old username rejected", False, f"Error: {str(e)}")
    
    # Test 5: Try to change to existing username (should fail)
    # First create another user
    existing_username = f"existing_{datetime.now().timestamp()}"
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json={
            "username": existing_username,
            "password": "pass123"
        })
        
        if response.status_code == 200:
            # Now try to change new_username to existing_username
            response = requests.put(
                f"{BASE_URL}/users/change-username",
                json={"new_username": existing_username},
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 400:
                log_test("Username already taken error", True, "Correctly rejected duplicate username")
            else:
                log_test("Username already taken error", False, f"Should reject duplicate. Status: {response.status_code}")
        else:
            log_test("Username already taken error", False, "Could not create existing user for test")
    except Exception as e:
        log_test("Username already taken error", False, f"Error: {str(e)}")
    
    # Test 6: Verify username propagation across collections
    # Create a friend relationship and verify username updates
    try:
        # Create another user to be friend
        friend_username = f"friend_{datetime.now().timestamp()}"
        response = requests.post(f"{BASE_URL}/auth/signup", json={
            "username": friend_username,
            "password": "friendpass123"
        })
        
        if response.status_code == 200:
            friend_token = response.json().get("token")
            
            # Send friend request from new_username to friend
            response = requests.post(
                f"{BASE_URL}/friends/request",
                json={"to_username": friend_username},
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                # Accept friend request
                response = requests.post(
                    f"{BASE_URL}/friends/accept/{new_username}",
                    headers={"Authorization": f"Bearer {friend_token}"}
                )
                
                if response.status_code == 200:
                    # Now change username again
                    final_username = f"final_{datetime.now().timestamp()}"
                    response = requests.put(
                        f"{BASE_URL}/users/change-username",
                        json={"new_username": final_username},
                        headers={"Authorization": f"Bearer {token}"}
                    )
                    
                    if response.status_code == 200:
                        final_token = response.json().get("token")
                        
                        # Verify friend list shows updated username
                        response = requests.get(
                            f"{BASE_URL}/friends/list",
                            headers={"Authorization": f"Bearer {friend_token}"}
                        )
                        
                        if response.status_code == 200:
                            friends = response.json()
                            friend_usernames = [f["username"] for f in friends]
                            
                            if final_username in friend_usernames:
                                log_test("Username propagation to friends collection", True, f"Friend sees updated username: {final_username}")
                            else:
                                log_test("Username propagation to friends collection", False, f"Friend list: {friend_usernames}, expected: {final_username}")
                        else:
                            log_test("Username propagation to friends collection", False, "Could not fetch friend list")
                    else:
                        log_test("Username propagation to friends collection", False, "Could not change username for propagation test")
                else:
                    log_test("Username propagation to friends collection", False, "Could not accept friend request")
            else:
                log_test("Username propagation to friends collection", False, "Could not send friend request")
        else:
            log_test("Username propagation to friends collection", False, "Could not create friend user")
    except Exception as e:
        log_test("Username propagation to friends collection", False, f"Error: {str(e)}")


# ============ PASSWORD CHANGE TESTS ============

def test_password_change():
    """Test password change endpoint"""
    print("\n" + "="*70)
    print("TESTING: Password Change Endpoint")
    print("="*70)
    
    # Test 1: Create test user
    test_username = f"pwduser_{datetime.now().timestamp()}"
    old_password = "oldpass123"
    
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json={
            "username": test_username,
            "password": old_password,
            "bio": "Test user for password change"
        })
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            log_test("Create test user for password change", True, f"User: {test_username}")
        else:
            log_test("Create test user for password change", False, f"Status: {response.status_code}, Response: {response.text}")
            return
    except Exception as e:
        log_test("Create test user for password change", False, f"Error: {str(e)}")
        return
    
    # Test 2: Try changing password with WRONG current password (should fail)
    try:
        response = requests.put(
            f"{BASE_URL}/users/change-password",
            json={
                "current_password": "wrongpassword",
                "new_password": "newpass123"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 400:
            log_test("Wrong current password rejected", True, "Correctly rejected wrong current password")
        else:
            log_test("Wrong current password rejected", False, f"Should reject wrong password. Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("Wrong current password rejected", False, f"Error: {str(e)}")
    
    # Test 3: Change password with CORRECT current password
    new_password = "newpass456"
    
    try:
        response = requests.put(
            f"{BASE_URL}/users/change-password",
            json={
                "current_password": old_password,
                "new_password": new_password
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("message") == "Password updated successfully":
                log_test("Change password successfully", True, "Password changed successfully")
            else:
                log_test("Change password successfully", False, f"Unexpected response: {data}")
        else:
            log_test("Change password successfully", False, f"Status: {response.status_code}, Response: {response.text}")
            return
    except Exception as e:
        log_test("Change password successfully", False, f"Error: {str(e)}")
        return
    
    # Test 4: Verify can login with new password
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "username": test_username,
            "password": new_password
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get("token"):
                log_test("Login with new password", True, f"Successfully logged in with new password")
            else:
                log_test("Login with new password", False, "No token returned")
        else:
            log_test("Login with new password", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("Login with new password", False, f"Error: {str(e)}")
    
    # Test 5: Verify old password doesn't work
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "username": test_username,
            "password": old_password
        })
        
        if response.status_code == 401:
            log_test("Old password rejected", True, "Old password correctly rejected")
        else:
            log_test("Old password rejected", False, f"Old password still works! Status: {response.status_code}")
    except Exception as e:
        log_test("Old password rejected", False, f"Error: {str(e)}")


# ============ MAIN ============

def main():
    print("\n" + "="*70)
    print("MindMatch Backend API Testing - Profile Update Endpoints")
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    # Run tests
    test_username_change()
    test_password_change()
    
    # Print summary
    print_summary()
    
    # Exit with appropriate code
    if test_results["failed"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
