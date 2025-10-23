#!/usr/bin/env python3
"""
TestBuddy Bot - Arkadaşlık isteklerini otomatik kabul eder ve oyun daveti bekler
"""
import requests
import time

TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJUZXN0QnVkZHkiLCJleHAiOjE3NjM3MDUxNzJ9.rTzWWp35vX65Q1ORk2Oi1GapOdongsl3SSwHkbQitrU"
API_URL = "http://localhost:8001"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

def check_and_accept_friend_requests():
    """Arkadaşlık isteklerini kontrol et ve kabul et"""
    try:
        response = requests.get(f"{API_URL}/api/friends/requests", headers=HEADERS)
        print(f"📬 Friend requests API response: {response.status_code}")
        if response.status_code == 200:
            requests_list = response.json()
            print(f"📬 Bekleyen istek sayısı: {len(requests_list)}")
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
    """Online olarak işaretle - /api/users/me çağrısı last_seen günceller"""
    try:
        response = requests.get(f"{API_URL}/api/users/me", headers=HEADERS)
        if response.status_code == 200:
            print("✓ TestBuddy online")
    except Exception as e:
        print(f"Mark online error: {e}")

def check_game_invites():
    """Oyun davetlerini kontrol et ve kelime gönder"""
    try:
        print("🔍 Oyunlar kontrol ediliyor...")
        # TestBuddy'nin player2 olduğu oyunları bul
        # MongoDB'de TestBuddy'nin oyunlarını bul
        import pymongo
        from datetime import datetime, timedelta
        
        client = pymongo.MongoClient("mongodb://localhost:27017")
        db = client["mindmatch_db"]
        games_collection = db["games"]
        
        # TestBuddy'nin sırası olan oyunları bul
        active_games = games_collection.find({
            "player2": "TestBuddy",
            "synced": False,
            "player1_word": {"$ne": None},  # Player1 kelime göndermiş
            "player2_word": None  # TestBuddy henüz göndermemiş
        })
        
        for game in active_games:
            game_id = game["_id"]
            player1_word = game.get("player1_word", "").upper()
            
            # Basit kelime seçimi (player1'in kelimesine benzer)
            simple_words = ["GAME", "PLAY", "FUN", "FRIEND", "CHAT", "WORD", "SYNC", "MIND", "MATCH", "CONNECT"]
            import random
            bot_word = random.choice(simple_words)
            
            print(f"🎮 Oyun {game_id[:8]}... için kelime gönderiliyor: {bot_word}")
            
            # Kelimeyi gönder
            response = requests.post(
                f"{API_URL}/api/game/{game_id}/submit-word",
                headers=HEADERS,
                json={"word": bot_word}
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("synced"):
                    print(f"✨ SYNC oldu! Kelime: {result.get('sync_word')}")
                else:
                    print(f"✓ Kelime gönderildi, Round {result.get('current_round', '?')}")
    except Exception as e:
        print(f"Oyun kontrol hatası: {e}")

def main():
    print("🤖 TestBuddy Bot başlatıldı!")
    print("📱 Kullanıcı adı: TestBuddy")
    print("🎮 Arkadaşlık istekleri otomatik kabul ediliyor...")
    print("💡 Çıkmak için Ctrl+C yapın\n")
    
    while True:
        try:
            mark_online()
            check_and_accept_friend_requests()
            check_game_invites()
            time.sleep(5)  # 5 saniyede bir kontrol et
        except KeyboardInterrupt:
            print("\n👋 TestBuddy Bot durduruluyor...")
            sys.exit(0)
        except Exception as e:
            print(f"❌ Hata: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
