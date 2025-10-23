from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import jwt
import os
from dotenv import load_dotenv
from bson import ObjectId
from emergentintegrations.llm.chat import LlmChat, UserMessage
import random

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "mindmatch_db")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# JWT & Auth setup
SECRET_KEY = "mindmatch_secret_key_2024_secure"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Collections
users_collection = db["users"]
friends_collection = db["friends"]
games_collection = db["games"]
rounds_collection = db["rounds"]
chats_collection = db["chats"]
badges_collection = db["badges"]

# Emergent LLM Key for AI opponent
EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY")


# ============ MODELS ============

class UserSignup(BaseModel):
    username: str
    password: str
    bio: Optional[str] = ""
    age: Optional[int] = None
    country: Optional[str] = ""
    avatar: Optional[str] = ""  # base64 image


class UserLogin(BaseModel):
    username: str
    password: str


class FriendRequest(BaseModel):
    to_username: str


class CreateGame(BaseModel):
    mode: str  # "friend", "random", "ai"
    opponent_username: Optional[str] = None


class SubmitWord(BaseModel):
    word: str


class SendMessage(BaseModel):
    to_username: str
    message: str


class UpdateProfile(BaseModel):
    bio: Optional[str] = None
    age: Optional[int] = None
    country: Optional[str] = None
    avatar: Optional[str] = None


# ============ UTILITIES ============

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(days=30)
    to_encode = {"sub": username, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    username = decode_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    return username


def calculate_wavelength_score(rounds: int) -> int:
    """Calculate wavelength score based on number of rounds taken"""
    if rounds == 1:
        return 100
    elif rounds == 2:
        return 95
    elif rounds == 3:
        return 85
    elif rounds == 4:
        return 75
    elif rounds == 5:
        return 65
    else:
        return max(50, 100 - (rounds * 8))


async def award_badge(username: str, badge_type: str, badge_name: str):
    """Award badge to user if they don't have it"""
    existing_badge = await badges_collection.find_one({
        "username": username,
        "badge_type": badge_type
    })
    if not existing_badge:
        await badges_collection.insert_one({
            "username": username,
            "badge_type": badge_type,
            "badge_name": badge_name,
            "earned_at": datetime.utcnow()
        })


async def update_user_stats(username: str, synced: bool, rounds: int):
    """Update user XP, level, and connection score"""
    user = await users_collection.find_one({"username": username})
    if not user:
        return
    
    # Award XP
    xp_gain = 50 if synced else 20
    new_xp = user.get("xp", 0) + xp_gain
    new_level = (new_xp // 100) + 1
    
    # Update connection score
    total_games = user.get("total_games", 0) + 1
    successful_syncs = user.get("successful_syncs", 0) + (1 if synced else 0)
    connection_score = int((successful_syncs / total_games) * 100) if total_games > 0 else 0
    
    await users_collection.update_one(
        {"username": username},
        {
            "$set": {
                "xp": new_xp,
                "level": new_level,
                "total_games": total_games,
                "successful_syncs": successful_syncs,
                "connection_score": connection_score
            }
        }
    )
    
    # Check for badge awards
    if successful_syncs >= 3:
        await award_badge(username, "mind_reader", "Mind Reader")
    if total_games >= 50:
        await award_badge(username, "word_wizard", "Word Wizard")
    if rounds == 1 and synced:
        await award_badge(username, "harmony_hunter", "Harmony Hunter")


async def get_ai_word(word1: str, word2: str, is_initial: bool = False, round_num: int = 1) -> str:
    """Get AI-generated connecting word using Claude"""
    try:
        # Make AI play more realistically - not too perfect
        if is_initial:
            system_message = "You are playing a word association game. Generate a random, common word. Reply with ONLY ONE WORD in uppercase."
            prompt = "Think of ONE random everyday word (object, place, feeling, or activity). Just say the word, nothing else."
        else:
            system_message = """You are playing a word-association game called MindMatch. 
            
RULES:
- Two players each said a different word in the previous round
- Now you must find ONE connecting word that links BOTH words
- Choose the MOST OBVIOUS connection that most people would think of
- Don't overthink it - use common associations
- Reply with ONLY ONE WORD in uppercase

EXAMPLES:
- WATER + UMBRELLA → RAIN (because rain involves both water and umbrellas)
- CAR + HOUSE → GARAGE (because garages connect cars and houses)
- PHONE + MUSIC → APP (because music apps are on phones)
- SUN + BEACH → SUMMER (because summer connects sun and beaches)"""
            
            prompt = f"""Previous round: Player 1 said '{word1}' and Player 2 said '{word2}'.

What is the MOST OBVIOUS word that connects both '{word1}' and '{word2}'?
Think like an average person would think. What's the first connection that comes to mind?

Reply with ONLY that ONE connecting word in uppercase. No explanation."""
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ai_game_{datetime.utcnow().timestamp()}_{round_num}",
            system_message=system_message
        ).with_model("anthropic", "claude-3-7-sonnet-20250219")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Extract just the word and clean it
        ai_word = response.strip().split('\n')[0].split()[0].upper()
        # Remove any punctuation
        ai_word = ''.join(c for c in ai_word if c.isalpha())
        
        return ai_word
    except Exception as e:
        print(f"AI error: {e}")
        # Fallback words - more variety
        fallback_words = ["HOME", "TIME", "LIFE", "WATER", "LIGHT", "SOUND", "TREE", "BOOK", "PHONE", "MUSIC"]
        return random.choice(fallback_words)


# ============ AUTH ENDPOINTS ============

@app.post("/api/auth/signup")
async def signup(user: UserSignup):
    # Check if username exists
    existing_user = await users_collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    user_doc = {
        "username": user.username,
        "password": hash_password(user.password),
        "bio": user.bio,
        "age": user.age,
        "country": user.country,
        "avatar": user.avatar,
        "created_at": datetime.utcnow(),
        "last_seen": datetime.utcnow(),
        "online_status": True,
        "xp": 0,
        "level": 1,
        "connection_score": 0,
        "total_games": 0,
        "successful_syncs": 0,
        "current_streak": 0,
        "last_played": None
    }
    await users_collection.insert_one(user_doc)
    
    token = create_token(user.username)
    return {"token": token, "username": user.username}


@app.post("/api/auth/login")
async def login(user: UserLogin):
    db_user = await users_collection.find_one({"username": user.username})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Update online status
    await users_collection.update_one(
        {"username": user.username},
        {"$set": {"online_status": True, "last_seen": datetime.utcnow()}}
    )
    
    token = create_token(user.username)
    return {"token": token, "username": user.username}


# ============ USER ENDPOINTS ============

@app.get("/api/users/me")
async def get_my_profile(current_user: str = Depends(get_current_user)):
    # Update last_seen
    await users_collection.update_one(
        {"username": current_user},
        {"$set": {"last_seen": datetime.utcnow()}}
    )
    
    user = await users_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get badges
    user_badges = await badges_collection.find({"username": current_user}).to_list(100)
    
    return {
        "username": user["username"],
        "bio": user.get("bio", ""),
        "age": user.get("age"),
        "country": user.get("country", ""),
        "avatar": user.get("avatar", ""),
        "xp": user.get("xp", 0),
        "level": user.get("level", 1),
        "connection_score": user.get("connection_score", 0),
        "total_games": user.get("total_games", 0),
        "successful_syncs": user.get("successful_syncs", 0),
        "current_streak": user.get("current_streak", 0),
        "badges": [{"type": b["badge_type"], "name": b["badge_name"]} for b in user_badges]
    }


@app.put("/api/users/profile")
async def update_profile(profile: UpdateProfile, current_user: str = Depends(get_current_user)):
    update_data = {}
    if profile.bio is not None:
        update_data["bio"] = profile.bio
    if profile.age is not None:
        update_data["age"] = profile.age
    if profile.country is not None:
        update_data["country"] = profile.country
    if profile.avatar is not None:
        update_data["avatar"] = profile.avatar
    
    await users_collection.update_one(
        {"username": current_user},
        {"$set": update_data}
    )
    return {"message": "Profile updated"}


@app.get("/api/users/online")
async def get_online_users(current_user: str = Depends(get_current_user)):
    # Update current user's last_seen
    await users_collection.update_one(
        {"username": current_user},
        {"$set": {"last_seen": datetime.utcnow()}}
    )
    
    # Get users who were active in last 5 minutes
    cutoff_time = datetime.utcnow() - timedelta(minutes=5)
    online_users = await users_collection.find({
        "username": {"$ne": current_user},
        "last_seen": {"$gte": cutoff_time}
    }).to_list(100)
    
    # Get friend list
    friend_docs = await friends_collection.find({
        "$or": [
            {"user1": current_user, "status": "accepted"},
            {"user2": current_user, "status": "accepted"}
        ]
    }).to_list(100)
    
    friend_usernames = set()
    for friend_doc in friend_docs:
        if friend_doc["user1"] == current_user:
            friend_usernames.add(friend_doc["user2"])
        else:
            friend_usernames.add(friend_doc["user1"])
    
    result = []
    for user in online_users:
        result.append({
            "username": user["username"],
            "bio": user.get("bio", ""),
            "age": user.get("age"),
            "country": user.get("country", ""),
            "avatar": user.get("avatar", ""),
            "level": user.get("level", 1),
            "connection_score": user.get("connection_score", 0),
            "is_friend": user["username"] in friend_usernames,
            "online": True
        })
    
    # Sort: friends first, then by level
    result.sort(key=lambda x: (not x["is_friend"], -x["level"]))
    return result


@app.get("/api/users/search/{username}")
async def search_user(username: str, current_user: str = Depends(get_current_user)):
    user = await users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if friend
    friend_doc = await friends_collection.find_one({
        "$or": [
            {"user1": current_user, "user2": username},
            {"user1": username, "user2": current_user}
        ]
    })
    
    is_friend = friend_doc is not None and friend_doc["status"] == "accepted"
    has_pending_request = friend_doc is not None and friend_doc["status"] == "pending"
    
    return {
        "username": user["username"],
        "bio": user.get("bio", ""),
        "age": user.get("age"),
        "country": user.get("country", ""),
        "avatar": user.get("avatar", ""),
        "level": user.get("level", 1),
        "connection_score": user.get("connection_score", 0),
        "is_friend": is_friend,
        "has_pending_request": has_pending_request
    }


# ============ FRIEND ENDPOINTS ============

@app.post("/api/friends/request")
async def send_friend_request(request: FriendRequest, current_user: str = Depends(get_current_user)):
    # Check if user exists
    target_user = await users_collection.find_one({"username": request.to_username})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already friends or pending
    existing = await friends_collection.find_one({
        "$or": [
            {"user1": current_user, "user2": request.to_username},
            {"user1": request.to_username, "user2": current_user}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Friend request already exists")
    
    # Create friend request
    await friends_collection.insert_one({
        "user1": current_user,
        "user2": request.to_username,
        "status": "pending",
        "requested_at": datetime.utcnow()
    })
    
    return {"message": "Friend request sent"}


@app.get("/api/friends/requests")
async def get_friend_requests(current_user: str = Depends(get_current_user)):
    # Get incoming requests
    requests = await friends_collection.find({
        "user2": current_user,
        "status": "pending"
    }).to_list(100)
    
    result = []
    for req in requests:
        user = await users_collection.find_one({"username": req["user1"]})
        if user:
            result.append({
                "username": user["username"],
                "bio": user.get("bio", ""),
                "avatar": user.get("avatar", ""),
                "level": user.get("level", 1)
            })
    
    return result


@app.post("/api/friends/accept/{username}")
async def accept_friend_request(username: str, current_user: str = Depends(get_current_user)):
    await friends_collection.update_one(
        {"user1": username, "user2": current_user, "status": "pending"},
        {"$set": {"status": "accepted", "accepted_at": datetime.utcnow()}}
    )
    return {"message": "Friend request accepted"}


@app.delete("/api/friends/{username}")
async def remove_friend(username: str, current_user: str = Depends(get_current_user)):
    await friends_collection.delete_one({
        "$or": [
            {"user1": current_user, "user2": username},
            {"user1": username, "user2": current_user}
        ]
    })
    return {"message": "Friend removed"}


@app.get("/api/friends/list")
async def get_friends(current_user: str = Depends(get_current_user)):
    friend_docs = await friends_collection.find({
        "$or": [
            {"user1": current_user, "status": "accepted"},
            {"user2": current_user, "status": "accepted"}
        ]
    }).to_list(100)
    
    friend_usernames = []
    for friend_doc in friend_docs:
        if friend_doc["user1"] == current_user:
            friend_usernames.append(friend_doc["user2"])
        else:
            friend_usernames.append(friend_doc["user1"])
    
    friends = []
    for username in friend_usernames:
        user = await users_collection.find_one({"username": username})
        if user:
            # Check if online (last seen within 5 minutes)
            cutoff_time = datetime.utcnow() - timedelta(minutes=5)
            is_online = user.get("last_seen", datetime.min) >= cutoff_time
            
            friends.append({
                "username": user["username"],
                "bio": user.get("bio", ""),
                "avatar": user.get("avatar", ""),
                "level": user.get("level", 1),
                "online": is_online
            })
    
    return friends


# ============ GAME ENDPOINTS ============

@app.post("/api/game/create")
async def create_game(game_data: CreateGame, current_user: str = Depends(get_current_user)):
    game_id = str(ObjectId())
    
    if game_data.mode == "friend":
        if not game_data.opponent_username:
            raise HTTPException(status_code=400, detail="Opponent username required")
        opponent = game_data.opponent_username
    elif game_data.mode == "random":
        # Find random online user (simplified - in production, use matchmaking)
        cutoff_time = datetime.utcnow() - timedelta(minutes=5)
        online_users = await users_collection.find({
            "username": {"$ne": current_user},
            "last_seen": {"$gte": cutoff_time}
        }).to_list(100)
        if not online_users:
            raise HTTPException(status_code=404, detail="No online users available")
        opponent = random.choice(online_users)["username"]
    else:  # AI mode
        opponent = "AI"
    
    game_doc = {
        "_id": game_id,
        "player1": current_user,
        "player2": opponent,
        "mode": game_data.mode,
        "status": "round_1_initial",
        "current_round": 1,
        "player1_word": None,
        "player2_word": None,
        "created_at": datetime.utcnow(),
        "synced": False,
        "sync_word": None,
        "total_rounds": 0
    }
    
    try:
        print(f"🔍 Inserting to DB: {DB_NAME}, collection: games")
        print(f"🔍 Game doc: {game_id}, {current_user} vs {opponent}")
        result = await games_collection.insert_one(game_doc)
        print(f"✅ Game inserted: {result.inserted_id}")
        
        # Verify
        verify = await games_collection.find_one({"_id": game_id})
        if verify:
            print(f"✅ Verified in DB!")
        else:
            print(f"❌ NOT in DB after insert!")
    except Exception as e:
        print(f"❌ Insert error: {e}")
        raise
    
    return {"game_id": game_id, "opponent": opponent, "mode": game_data.mode}


@app.post("/api/game/{game_id}/submit-word")
async def submit_word(game_id: str, word_data: SubmitWord, current_user: str = Depends(get_current_user)):
    game = await games_collection.find_one({"_id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Check if user is in this game
    if current_user not in [game["player1"], game["player2"]]:
        raise HTTPException(status_code=403, detail="Not your game")
    
    word = word_data.word.upper().strip()
    player_field = "player1_word" if current_user == game["player1"] else "player2_word"
    
    # Update player's word
    await games_collection.update_one(
        {"_id": game_id},
        {"$set": {player_field: word}}
    )
    
    # If AI mode and player submitted, generate AI word
    if game["mode"] == "ai" and game["player2"] == "AI":
        if game["status"] == "round_1_initial":
            # AI generates initial word
            ai_word = await get_ai_word("", "", is_initial=True, round_num=1)
            await games_collection.update_one(
                {"_id": game_id},
                {"$set": {"player2_word": ai_word}}
            )
        else:
            # AI generates connecting word - use ONLY the revealed words from LAST round
            # Get the last completed round to see what words were revealed
            last_round = await rounds_collection.find_one(
                {"game_id": game_id, "round_number": game["current_round"] - 1}
            )
            if last_round:
                # AI sees the two words from the PREVIOUS round, not current player's word
                ai_word = await get_ai_word(
                    last_round["player1_word"], 
                    last_round["player2_word"],
                    is_initial=False,
                    round_num=game["current_round"]
                )
                await games_collection.update_one(
                    {"_id": game_id},
                    {"$set": {"player2_word": ai_word}}
                )
    
    # Refetch game
    game = await games_collection.find_one({"_id": game_id})
    
    # Check if both players have submitted
    if game["player1_word"] and game["player2_word"]:
        # Check for sync
        if game["player1_word"] == game["player2_word"]:
            # SYNC achieved!
            rounds = game["current_round"]
            wavelength_score = calculate_wavelength_score(rounds)
            
            # Save round
            await rounds_collection.insert_one({
                "game_id": game_id,
                "round_number": game["current_round"],
                "player1": game["player1"],
                "player2": game["player2"],
                "player1_word": game["player1_word"],
                "player2_word": game["player2_word"],
                "synced": True
            })
            
            # Update game
            await games_collection.update_one(
                {"_id": game_id},
                {
                    "$set": {
                        "status": "completed",
                        "synced": True,
                        "sync_word": game["player1_word"],
                        "total_rounds": rounds,
                        "wavelength_score": wavelength_score,
                        "completed_at": datetime.utcnow()
                    }
                }
            )
            
            # Update stats for both players
            await update_user_stats(game["player1"], True, rounds)
            if game["player2"] != "AI":
                await update_user_stats(game["player2"], True, rounds)
            
            return {"synced": True, "sync_word": game["player1_word"], "rounds": rounds, "wavelength_score": wavelength_score}
        else:
            # No sync, move to next round
            # Save round
            await rounds_collection.insert_one({
                "game_id": game_id,
                "round_number": game["current_round"],
                "player1": game["player1"],
                "player2": game["player2"],
                "player1_word": game["player1_word"],
                "player2_word": game["player2_word"],
                "synced": False
            })
            
            # Move to next round
            next_round = game["current_round"] + 1
            await games_collection.update_one(
                {"_id": game_id},
                {
                    "$set": {
                        "current_round": next_round,
                        "status": f"round_{next_round}",
                        "player1_word": None,
                        "player2_word": None
                    }
                }
            )
            
            return {"synced": False, "next_round": next_round}
    
    return {"waiting": True}


@app.get("/api/game/{game_id}/status")
async def get_game_status(game_id: str, current_user: str = Depends(get_current_user)):
    game = await games_collection.find_one({"_id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Get all rounds
    rounds_list = await rounds_collection.find({"game_id": game_id}).sort("round_number", 1).to_list(100)
    
    # Get player avatars
    player1_user = await users_collection.find_one({"username": game["player1"]})
    player2_user = await users_collection.find_one({"username": game["player2"]})
    
    return {
        "game_id": game_id,
        "player1": game["player1"],
        "player2": game["player2"],
        "player1_avatar": player1_user.get("avatar", "") if player1_user else "",
        "player2_avatar": player2_user.get("avatar", "") if player2_user else "",
        "mode": game["mode"],
        "status": game["status"],
        "current_round": game["current_round"],
        "player1_word": game.get("player1_word"),
        "player2_word": game.get("player2_word"),
        "synced": game.get("synced", False),
        "sync_word": game.get("sync_word"),
        "total_rounds": game.get("total_rounds", game["current_round"]),
        "wavelength_score": game.get("wavelength_score"),
        "rounds": [
            {
                "round": r["round_number"],
                "player1_word": r["player1_word"],
                "player2_word": r["player2_word"],
                "synced": r["synced"]
            }
            for r in rounds_list
        ]
    }


# ============ CHAT ENDPOINTS ============

@app.post("/api/chat/send")
async def send_message(msg: SendMessage, current_user: str = Depends(get_current_user)):
    # Check if users are friends
    friendship = await friends_collection.find_one({
        "$or": [
            {"user1": current_user, "user2": msg.to_username, "status": "accepted"},
            {"user1": msg.to_username, "user2": current_user, "status": "accepted"}
        ]
    })
    
    if not friendship:
        raise HTTPException(status_code=403, detail="Can only chat with friends")
    
    # Save message
    await chats_collection.insert_one({
        "from_username": current_user,
        "to_username": msg.to_username,
        "message": msg.message,
        "sent_at": datetime.utcnow(),
        "read": False
    })
    
    return {"message": "Message sent"}


@app.get("/api/chat/{username}")
async def get_chat_history(username: str, current_user: str = Depends(get_current_user)):
    # Get messages between users
    messages = await chats_collection.find({
        "$or": [
            {"from_username": current_user, "to_username": username},
            {"from_username": username, "to_username": current_user}
        ]
    }).sort("sent_at", 1).to_list(1000)
    
    # Mark messages as read
    await chats_collection.update_many(
        {"from_username": username, "to_username": current_user, "read": False},
        {"$set": {"read": True}}
    )
    
    return [
        {
            "from": msg["from_username"],
            "to": msg["to_username"],
            "message": msg["message"],
            "sent_at": msg["sent_at"].isoformat(),
            "is_mine": msg["from_username"] == current_user
        }
        for msg in messages
    ]


@app.get("/api/chat/conversations")
async def get_conversations(current_user: str = Depends(get_current_user)):
    """Get list of users current user can chat with (all friends)"""
    try:
        # Find all friends (accepted friendships)
        friendships = await friends_collection.find({
            "$or": [
                {"user1": current_user, "status": "accepted"},
                {"user2": current_user, "status": "accepted"}
            ]
        }).to_list(100)
        
        chat_partners = set()
        for friendship in friendships:
            partner = friendship["user2"] if friendship["user1"] == current_user else friendship["user1"]
            chat_partners.add(partner)
        
        result = []
        for partner_username in chat_partners:
            user = await users_collection.find_one({"username": partner_username})
            if user:
                # Get last message
                last_msg = await chats_collection.find_one({
                    "$or": [
                        {"from_username": current_user, "to_username": partner_username},
                        {"from_username": partner_username, "to_username": current_user}
                    ]
                }, sort=[("sent_at", -1)])
                
                # Count unread
                unread_count = await chats_collection.count_documents({
                    "from_username": partner_username,
                    "to_username": current_user,
                    "read": False
                })
                
                result.append({
                    "username": user["username"],
                    "avatar": user.get("avatar", ""),
                    "bio": user.get("bio", ""),
                    "last_message": last_msg["message"] if last_msg else "",
                    "last_message_time": last_msg["sent_at"].isoformat() if last_msg else "",
                    "unread_count": unread_count
                })
        
        # Sort by last message time
        result.sort(key=lambda x: x.get("last_message_time", ""), reverse=True)
        return result
    except Exception as e:
        import traceback
        import sys
        print(f"❌ Error in conversations: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return []


@app.get("/api/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
