import os
import datetime
from functools import wraps
import bcrypt
import jwt
from flask import request, jsonify, g
from db import find_user_by_id, format_user_doc

JWT_SECRET = os.environ.get("JWT_SECRET", "stockvision_super_secret_jwt_key_2026_finance_ml")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRATION_DAYS = 7

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def generate_token(user_id: str, username: str, email: str) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "email": email,
        "iat": now,
        "exp": now + datetime.timedelta(days=TOKEN_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def extract_token_from_header():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    # Check query param as fallback
    return request.args.get("token")

def get_optional_current_user():
    token = extract_token_from_header()
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    user = find_user_by_id(user_id)
    return format_user_doc(user)

def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = extract_token_from_header()
        if not token:
            return jsonify({"error": "Authorization token is missing. Please log in."}), 401

        payload = decode_token(token)
        if not payload:
            return jsonify({"error": "Invalid or expired session token. Please log in again."}), 401

        user_id = payload.get("sub")
        user = find_user_by_id(user_id)
        if not user:
            return jsonify({"error": "User account no longer exists."}), 401

        g.user_id = user_id
        g.user = format_user_doc(user)
        return f(*args, **kwargs)
    return decorated
