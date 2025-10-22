#!/usr/bin/env python3
"""
TestBuddy Bot - Arkadaşlık isteklerini otomatik kabul eder ve oyun daveti bekler
"""
import requests
import time
import sys

TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJUZXN0QnVkZHkiLCJleHAiOjE3NjM3MDUxNzJ9.rTzWWp35vX65Q1ORk2Oi1GapOdongsl3SSwHkbQitrU"
API_URL = "http://localhost:8001"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

def check_and_accept_friend_requests():
    """Arkadaşlık isteklerini kontrol et ve kabul et"""
    try:
        response = requests.get(f"{API_URL}/api/friends/requests", headers=HEADERS)
        if response.status_code == 200:
            requests_list = response.json()
            for req in requests_list:
                username = req.get("username")
                print(f"✓ Arkadaşlık isteği alındı: {username}")
                # İsteği kabul et
                accept_response = requests.post(
                    f"{API_URL}/api/friends/accept/{username}",
                    headers=HEADERS
                )
                if accept_response.status_code == 200:
                    print(f"✓ {username} ile arkadaş olundu!")
    except Exception as e:
        print(f"Hata: {e}")

def mark_online():
    """Online olarak işaretle"""
    try:
        requests.get(f"{API_URL}/api/users/online", headers=HEADERS)
    except:
        pass

def check_game_invites():
    """Oyun davetlerini kontrol et ve kelime gönder"""
    try:
        # Bekleyen oyunları bul (TestBuddy'nin sırası olan)
        response = requests.get(f"{API_URL}/api/users/me", headers=HEADERS)
        if response.status_code != 200:
            return
            
        # Kullanıcının katıldığı tüm oyunları kontrol et (basitleştirilmiş yaklaşım)
        # Not: Gerçek uygulamada pending games endpoint'i gerekir
        # Şimdilik bot pasif kalacak - kullanıcı AI mode kullanmalı
        pass
    except:
        pass

def main():
    print("🤖 TestBuddy Bot başlatıldı!")
    print("📱 Kullanıcı adı: TestBuddy")
    print("🎮 Arkadaşlık istekleri otomatik kabul ediliyor...")
    print("💡 Çıkmak için Ctrl+C yapın\n")
    
    while True:
        try:
            mark_online()
            check_and_accept_friend_requests()
            time.sleep(5)  # 5 saniyede bir kontrol et
        except KeyboardInterrupt:
            print("\n👋 TestBuddy Bot durduruluyor...")
            sys.exit(0)
        except Exception as e:
            print(f"❌ Hata: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
