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
game_invites_collection = db["game_invites"]

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


class GameInvite(BaseModel):
    to_username: str


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


async def update_user_stats(username: str, synced: bool, rounds: int, opponent: str = None):
    """Update user XP, level, and connection score"""
    user = await users_collection.find_one({"username": username})
    if not user:
        return
    
    # Award XP
    xp_gain = 50 if synced else 20
    new_xp = user.get("xp", 0) + xp_gain
    
    # New level formula: more gradual progression
    import math
    new_level = int(math.sqrt(new_xp / 50)) + 1
    
    # Update connection score
    total_games = user.get("total_games", 0) + 1
    successful_syncs = user.get("successful_syncs", 0) + (1 if synced else 0)
    connection_score = int((successful_syncs / total_games) * 100) if total_games > 0 else 0
    
    # Track perfect harmony (2nd round syncs)
    perfect_harmonies = user.get("perfect_harmonies", 0)
    if rounds == 2 and synced:
        perfect_harmonies += 1
    
    # Track partner syncs for Mind Twin badge
    partner_syncs = user.get("partner_syncs", {})
    if synced and opponent and opponent != "AI":
        partner_syncs[opponent] = partner_syncs.get(opponent, 0) + 1
    
    await users_collection.update_one(
        {"username": username},
        {
            "$set": {
                "xp": new_xp,
                "level": new_level,
                "total_games": total_games,
                "successful_syncs": successful_syncs,
                "connection_score": connection_score,
                "perfect_harmonies": perfect_harmonies,
                "partner_syncs": partner_syncs
            }
        }
    )
    
    # Check for badge awards
    if successful_syncs >= 10:
        await award_badge(username, "mind_reader", "🧠 Mind Reader")
    if perfect_harmonies >= 5:
        await award_badge(username, "perfect_harmony", "⚡ Perfect Harmony")
    if total_games >= 100:
        await award_badge(username, "game_master", "🎮 Game Master")
    
    # Check for Mind Twin badge (10 syncs with any single person)
    for partner, sync_count in partner_syncs.items():
        if sync_count >= 10:
            await award_badge(username, f"mind_twin_{partner}", f"💫 Mind Twin with {partner}")



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
                "online": is_online,
                "age": user.get("age"),
                "country": user.get("country", ""),
                "connection_score": user.get("connection_score", 0),
            })
    
    return friends


# ============ GAME ENDPOINTS ============

@app.post("/api/game/invite")
async def send_game_invite(invite_data: GameInvite, current_user: str = Depends(get_current_user)):
    """Send a game invitation to a friend"""
    # Check if they are friends
    friendship = await friends_collection.find_one({
        "$or": [
            {"user1": current_user, "user2": invite_data.to_username, "status": "accepted"},
            {"user1": invite_data.to_username, "user2": current_user, "status": "accepted"}
        ]
    })
    
    if not friendship:
        raise HTTPException(status_code=403, detail="Can only invite friends")
    
    # Check if invite already exists
    existing_invite = await game_invites_collection.find_one({
        "from_username": current_user,
        "to_username": invite_data.to_username,
        "status": "pending"
    })
    
    if existing_invite:
        raise HTTPException(status_code=400, detail="Invite already sent")
    
    # Create invite
    invite_id = str(ObjectId())
    await game_invites_collection.insert_one({
        "_id": invite_id,
        "from_username": current_user,
        "to_username": invite_data.to_username,
        "status": "pending",
        "created_at": datetime.utcnow()
    })
    
    return {"message": "Game invite sent", "invite_id": invite_id}


@app.get("/api/game/invites")
async def get_game_invites(current_user: str = Depends(get_current_user)):
    """Get pending game invites for current user"""
    invites = await game_invites_collection.find({
        "to_username": current_user,
        "status": "pending"
    }).to_list(100)
    
    result = []
    for invite in invites:
        from_user = await users_collection.find_one({"username": invite["from_username"]})
        if from_user:
            result.append({
                "invite_id": invite["_id"],
                "from_username": from_user["username"],
                "to_username": current_user,
                "status": "pending",
                "from_user_avatar": from_user.get("avatar", "🎮"),
                "from_user_level": from_user.get("level", 1),
                "created_at": invite["created_at"].isoformat()
            })
    
    return result


@app.post("/api/game/invite/{invite_id}/accept")
async def accept_game_invite(invite_id: str, current_user: str = Depends(get_current_user)):
    """Accept a game invitation and create game"""
    invite = await game_invites_collection.find_one({"_id": invite_id})
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite["to_username"] != current_user:
        raise HTTPException(status_code=403, detail="Not your invite")
    
    if invite["status"] != "pending":
        raise HTTPException(status_code=400, detail="Invite already processed")
    
    # Create game
    game_id = str(ObjectId())
    await games_collection.insert_one({
        "_id": game_id,
        "player1": invite["from_username"],
        "player2": current_user,
        "mode": "friend",
        "status": "round_1_initial",
        "current_round": 1,
        "player1_word": None,
        "player2_word": None,
        "created_at": datetime.utcnow(),
        "synced": False,
        "sync_word": None,
        "total_rounds": 0
    })
    
    # Mark invite as accepted
    await game_invites_collection.update_one(
        {"_id": invite_id},
        {"$set": {"status": "accepted"}}
    )
    
    return {"game_id": game_id, "opponent": invite["from_username"]}


@app.post("/api/game/invite/{invite_id}/decline")
async def decline_game_invite(invite_id: str, current_user: str = Depends(get_current_user)):
    """Decline a game invitation"""
    invite = await game_invites_collection.find_one({"_id": invite_id})
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite["to_username"] != current_user:
        raise HTTPException(status_code=403, detail="Not your invite")
    
    # Mark invite as declined
    await game_invites_collection.update_one(
        {"_id": invite_id},
        {"$set": {"status": "declined"}}
    )
    
    return {"message": "Invite declined"}


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
        "start_time": datetime.utcnow(),
        "end_time": None,
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


@app.get("/api/game/active")
async def get_active_games(current_user: str = Depends(get_current_user)):
    """Get active games for current user"""
    games = await games_collection.find({
        "$or": [
            {"player1": current_user},
            {"player2": current_user}
        ],
        "status": {"$nin": ["completed", "abandoned"]}
    }).sort("created_at", -1).to_list(50)
    
    result = []
    for game in games:
        opponent = game["player2"] if game["player1"] == current_user else game["player1"]
        opponent_user = await users_collection.find_one({"username": opponent})
        
        result.append({
            "game_id": game["_id"],
            "opponent": opponent,
            "opponent_avatar": opponent_user.get("avatar", "🎮") if opponent_user else "🎮",
            "mode": game["mode"],
            "status": game["status"],
            "current_round": game.get("current_round", 1),
            "created_at": game["created_at"].isoformat()
        })
    
    return result


@app.post("/api/game/{game_id}/abandon")
async def abandon_game(game_id: str, current_user: str = Depends(get_current_user)):
    """Abandon/end an active game"""
    game = await games_collection.find_one({"_id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Check if user is in this game
    if current_user not in [game["player1"], game["player2"]]:
        raise HTTPException(status_code=403, detail="Not your game")
    
    # Update game status to abandoned
    await games_collection.update_one(
        {"_id": game_id},
        {"$set": {"status": "abandoned"}}
    )
    
    return {"message": "Game abandoned successfully"}


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
                        "completed_at": datetime.utcnow(),
                        "end_time": datetime.utcnow()
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
    
    # Determine if both players have submitted their words for current round
    # Only show words if BOTH players have submitted
    player1_word = game.get("player1_word")
    player2_word = game.get("player2_word")
    
    # Hide words if not both submitted (unless game is completed/abandoned)
    both_submitted = player1_word is not None and player2_word is not None
    status = game["status"]
    
    if not both_submitted and status not in ["completed", "abandoned"]:
        # Hide the opponent's word
        if current_user == game["player1"]:
            player2_word = None  # Hide opponent's word
        else:
            player1_word = None  # Hide opponent's word
    
    return {
        "game_id": game_id,
        "player1": game["player1"],
        "player2": game["player2"],
        "player1_avatar": player1_user.get("avatar", "") if player1_user else "",
        "player2_avatar": player2_user.get("avatar", "") if player2_user else "",
        "mode": game["mode"],
        "status": status,
        "current_round": game["current_round"],
        "player1_word": player1_word,
        "player2_word": player2_word,
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


@app.get("/api/chat/unread-count")
async def get_unread_count(current_user: str = Depends(get_current_user)):
    """Get total unread message count for current user"""
    unread_count = await chats_collection.count_documents({
        "to_username": current_user,
        "read": False
    })
    return {"unread_count": unread_count}


@app.get("/api/chat/unread-by-user")
async def get_unread_by_user(current_user: str = Depends(get_current_user)):
    """Get unread message count per friend"""
    pipeline = [
        {"$match": {"to_username": current_user, "read": False}},
        {"$group": {"_id": "$from_username", "count": {"$sum": 1}}}
    ]
    
    results = await chats_collection.aggregate(pipeline).to_list(100)
    
    # Convert to dict {username: count}
    unread_dict = {item["_id"]: item["count"] for item in results}
    return unread_dict


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
        # Basit ve direkt çözüm - tüm arkadaşları getir
        friendships = await friends_collection.find({
            "$or": [
                {"user1": current_user, "status": "accepted"},
                {"user2": current_user, "status": "accepted"}
            ]
        }).to_list(100)
        
        # Debug: Check if we found friendships
        if len(friendships) == 0:
            print(f"⚠️ No friendships found for {current_user}")
            return []
        
        print(f"✅ Found {len(friendships)} friendships for {current_user}")
        
        result = []
        for friendship in friendships:
            # Partner username bul
            partner_username = friendship["user2"] if friendship["user1"] == current_user else friendship["user1"]
            
            # Partner bilgilerini çek
            partner = await users_collection.find_one({"username": partner_username})
            if not partner:
                continue
            
            # Son mesajı bul
            last_msg = await chats_collection.find_one({
                "$or": [
                    {"from_username": current_user, "to_username": partner_username},
                    {"from_username": partner_username, "to_username": current_user}
                ]
            }, sort=[("sent_at", -1)])
            
            # Okunmamış mesaj sayısı
            unread_count = await chats_collection.count_documents({
                "from_username": partner_username,
                "to_username": current_user,
                "read": False
            })
            
            # Ensure all data is JSON serializable - convert to simple types
            result.append({
                "username": partner.get("username", ""),
                "avatar": partner.get("avatar", ""),
                "bio": partner.get("bio", ""),
                "last_message": last_msg.get("message", "") if last_msg else "",
                "last_message_time": last_msg.get("sent_at").isoformat() if last_msg and last_msg.get("sent_at") else "",
                "unread_count": unread_count
            })
        
        return result
    except Exception as e:
        print(f"❌ CONVERSATIONS ERROR: {str(e)}")
        return []


@app.get("/api/chat/test")
async def test_conversations(current_user: str = Depends(get_current_user)):
    """Test endpoint"""
    friendships = await friends_collection.find({
        "$or": [
            {"user1": current_user, "status": "accepted"},
            {"user2": current_user, "status": "accepted"}
        ]
    }).to_list(100)
    
    # Return detailed debug information
    return {
        "debug": "test_conversations_endpoint",
        "current_user": current_user,
        "friendships_count": len(friendships),
        "friendships": [{"user1": f["user1"], "user2": f["user2"], "status": f["status"]} for f in friendships],
        "raw_friendships": friendships
    }

@app.get("/api/debug/friendships")
async def debug_friendships(current_user: str = Depends(get_current_user)):
    """New debug endpoint to test friendships"""
    friendships = await friends_collection.find({
        "$or": [
            {"user1": current_user, "status": "accepted"},
            {"user2": current_user, "status": "accepted"}
        ]
    }).to_list(100)
    
    # Convert to simple dict without ObjectIds
    simple_friendships = []
    for f in friendships:
        simple_friendships.append({
            "user1": f.get("user1"),
            "user2": f.get("user2"),
            "status": f.get("status"),
            "requested_at": f.get("requested_at").isoformat() if f.get("requested_at") else None,
            "accepted_at": f.get("accepted_at").isoformat() if f.get("accepted_at") else None
        })
    
    return {
        "endpoint": "debug_friendships",
        "user": current_user,
        "count": len(friendships),
        "data": simple_friendships
    }

@app.get("/api/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
