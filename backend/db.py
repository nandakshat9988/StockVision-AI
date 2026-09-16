import os
import datetime
from pathlib import Path
from bson import ObjectId
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from dotenv import load_dotenv
import certifi

# Load .env file from root or backend directory
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://lenalal763_db_user:lv1nSyrUN7bzkWV6@linkup.y9hcpjr.mongodb.net/Stockvision?retryWrites=true&w=majority&appName=LinkUp"
)
DEFAULT_DB_NAME = os.environ.get("MONGO_DB_NAME", "Stockvision")
DEFAULT_COLLECTION_NAME = os.environ.get("MONGO_COLLECTION_NAME", "stockvison user")

# Initialize client
client = None
db = None

def get_db():
    global client, db
    if db is None:
        try:
            mongo_kwargs = {"serverSelectionTimeoutMS": 5000}
            if "mongodb+srv" in MONGO_URI or "ssl" in MONGO_URI.lower():
                mongo_kwargs["tlsCAFile"] = certifi.where()

            temp_client = MongoClient(MONGO_URI, **mongo_kwargs)
            temp_client.admin.command("ping")
            client = temp_client
            db_name = DEFAULT_DB_NAME
            clean_uri = MONGO_URI.replace("mongodb://", "").replace("mongodb+srv://", "")
            if "/" in clean_uri:
                path_part = clean_uri.split("/")[1].split("?")[0]
                if path_part:
                    db_name = path_part
            
            existing_dbs = client.list_database_names()
            matched_name = next((d for d in existing_dbs if d.lower() == db_name.lower()), db_name)
            db = client[matched_name]
            print(f"MongoDB Atlas connected to database '{matched_name}', collection '{get_col_name()}'")
        except Exception as atlas_err:
            print(f"MongoDB Atlas connection notice: {atlas_err}")
            print("Connecting to local MongoDB service (mongodb://localhost:27017)...")
            try:
                client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=2000)
                client.admin.command("ping")
                existing_dbs = client.list_database_names()
                fallback_name = next((d for d in existing_dbs if d.lower() == "stockvision"), "stockvision")
                db = client[fallback_name]
                print(f"Local MongoDB connected successfully to '{fallback_name}'.")
            except Exception as local_err:
                print(f"Local MongoDB error: {local_err}")
                return None

        try:
            col = get_users_col()
            if col is not None:
                col.create_index([("email", ASCENDING)], unique=True)
                col.create_index([("username", ASCENDING)], unique=True)
        except Exception:
            pass
    return db

def get_col_name():
    database = db
    if database is None and client is not None:
        database = client[DEFAULT_DB_NAME]
    if database is not None:
        try:
            existing = database.list_collection_names()
            for name in [DEFAULT_COLLECTION_NAME, "stockvison user", "stockvision users", "users"]:
                if name in existing:
                    return name
        except Exception:
            pass
    return DEFAULT_COLLECTION_NAME

def get_users_col():
    database = get_db()
    if database is None:
        return None
    return database[get_col_name()]

def format_user_doc(doc):
    if not doc:
        return None
    doc_copy = dict(doc)
    doc_copy["id"] = str(doc_copy.pop("_id"))
    doc_copy.pop("password_hash", None)
    if "favorites" not in doc_copy:
        doc_copy["favorites"] = []
    if "recent_stocks" not in doc_copy:
        doc_copy["recent_stocks"] = []
    return doc_copy

def create_user(username, email, password_hash):
    col = get_users_col()
    if col is None:
        raise RuntimeError("Database connection not available")
    
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_user = {
        "username": username.strip().lower(),
        "email": email.strip().lower(),
        "password_hash": password_hash,
        "favorites": [],
        "recent_stocks": [],
        "created_at": now,
        "updated_at": now
    }
    
    try:
        res = col.insert_one(new_user)
        new_user["_id"] = res.inserted_id
        return format_user_doc(new_user)
    except DuplicateKeyError as e:
        if "email" in str(e):
            raise ValueError("An account with this email already exists.")
        if "username" in str(e):
            raise ValueError("This username is already taken.")
        raise ValueError("User with this email or username already exists.")

def find_user_by_identifier(identifier):
    col = get_users_col()
    if col is None:
        return None
    clean_id = identifier.strip().lower()
    return col.find_one({
        "$or": [
            {"email": clean_id},
            {"username": clean_id}
        ]
    })

def find_user_by_id(user_id):
    col = get_users_col()
    if col is None:
        return None
    try:
        obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        return col.find_one({"_id": obj_id})
    except Exception:
        return None

def add_recent_stock(user_id, symbol):
    col = get_users_col()
    if col is None:
        return False
    try:
        obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        user = col.find_one({"_id": obj_id})
        if not user:
            return False
        
        sym = symbol.strip().upper()
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        existing = user.get("recent_stocks", [])
        # Filter out existing occurrences of this symbol to avoid duplicates
        filtered = [item for item in existing if item.get("symbol") != sym]
        # Prepend new item
        updated_recent = [{"symbol": sym, "timestamp": now}] + filtered
        # Limit to 10 most recent
        updated_recent = updated_recent[:10]
        
        col.update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "recent_stocks": updated_recent,
                    "updated_at": now
                }
            }
        )
        return True
    except Exception as e:
        print(f"Error adding recent stock: {e}")
        return False

def add_favorite_stock(user_id, symbol):
    col = get_users_col()
    if col is None:
        return False
    try:
        obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        sym = symbol.strip().upper()
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        col.update_one(
            {"_id": obj_id},
            {
                "$addToSet": {"favorites": sym},
                "$set": {"updated_at": now}
            }
        )
        return True
    except Exception as e:
        print(f"Error adding favorite stock: {e}")
        return False

def remove_favorite_stock(user_id, symbol):
    col = get_users_col()
    if col is None:
        return False
    try:
        obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        sym = symbol.strip().upper()
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        col.update_one(
            {"_id": obj_id},
            {
                "$pull": {"favorites": sym},
                "$set": {"updated_at": now}
            }
        )
        return True
    except Exception as e:
        print(f"Error removing favorite stock: {e}")
        return False

def get_user_favorites(user_id):
    user = find_user_by_id(user_id)
    if not user:
        return []
    return user.get("favorites", [])

def get_user_recent_stocks(user_id):
    user = find_user_by_id(user_id)
    if not user:
        return []
    return user.get("recent_stocks", [])
