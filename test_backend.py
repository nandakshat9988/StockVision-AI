import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app import app
from db import get_db

def run_tests():
    print("=== STARTING BACKEND INTEGRATION TESTS ===")
    client = app.test_client()

    # Clean up test users if existing
    db = get_db()
    if db is not None:
        db.users.delete_many({"email": "testuser_unique@example.com"})
        print("Cleared previous test user from MongoDB.")

    # 1. Test Health Check
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.data}"
    print("Test 1: Health check passed!")

    # 2. Test User Registration
    reg_payload = {
        "username": "testtrader",
        "email": "testuser_unique@example.com",
        "password": "SecretPassword123!"
    }
    res = client.post("/api/auth/register", json=reg_payload)
    assert res.status_code == 201, f"Registration failed: {res.data}"
    reg_data = res.get_json()
    assert "token" in reg_data, "Token missing in registration"
    assert reg_data["user"]["username"] == "testtrader"
    token = reg_data["token"]
    user_id = reg_data["user"]["id"]
    print("Test 2: Registration passed, JWT issued!")

    # 3. Test Duplicate Registration (Should fail with 409)
    res = client.post("/api/auth/register", json=reg_payload)
    assert res.status_code == 409, f"Duplicate registration should fail: {res.data}"
    print("Test 3: Duplicate user rejection passed!")

    # 4. Test Login
    login_payload = {
        "emailOrUsername": "testtrader",
        "password": "SecretPassword123!"
    }
    res = client.post("/api/auth/login", json=login_payload)
    assert res.status_code == 200, f"Login failed: {res.data}"
    login_data = res.get_json()
    assert "token" in login_data
    token = login_data["token"]
    print("Test 4: Login passed!")

    # 5. Test Auth /me with JWT header
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200, f"Me endpoint failed: {res.data}"
    me_data = res.get_json()
    assert me_data["user"]["email"] == "testuser_unique@example.com"
    print("Test 5: Auth /me verification passed!")

    # 6. Test User Profile
    res = client.get("/api/user/profile", headers=headers)
    assert res.status_code == 200, f"Profile failed: {res.data}"
    prof_data = res.get_json()["profile"]
    assert "stats" in prof_data
    print("Test 6: User profile retrieval passed!")

    # 7. Test Add & Get Favorite Stock
    res = client.post("/api/user/favorites", json={"symbol": "NVDA"}, headers=headers)
    assert res.status_code == 200
    res = client.post("/api/user/favorites", json={"symbol": "AAPL"}, headers=headers)
    assert res.status_code == 200

    res = client.get("/api/user/favorites", headers=headers)
    assert res.status_code == 200
    favs = res.get_json()["favorites"]
    assert "NVDA" in favs and "AAPL" in favs
    print(f"Test 7: Add & Get Favorites passed! Current favorites: {favs}")

    # 8. Test Add & Get Recent Stocks
    res = client.post("/api/user/recent", json={"symbol": "TSLA"}, headers=headers)
    assert res.status_code == 200
    res = client.post("/api/user/recent", json={"symbol": "MSFT"}, headers=headers)
    assert res.status_code == 200

    res = client.get("/api/user/recent", headers=headers)
    assert res.status_code == 200
    recent = res.get_json()["recent_stocks"]
    assert len(recent) == 2
    assert recent[0]["symbol"] == "MSFT"  # most recent first
    print(f"Test 8: Recent stocks tracking passed! Recent: {[r['symbol'] for r in recent]}")

    # 9. Test 3 Top Stock News
    res = client.get("/api/news/top?limit=3")
    assert res.status_code == 200, f"Top news failed: {res.data}"
    top_news = res.get_json()["news"]
    print(f"Test 9: Top market news passed! Received {len(top_news)} articles:")
    for n in top_news:
        print(f"   - [{n.get('sentiment')}] {n.get('title')[:60]}... ({n.get('publisher')})")

    # 10. Test 3 News for Favorite Stocks
    res = client.get("/api/user/favorite-news?limit=3", headers=headers)
    assert res.status_code == 200, f"Favorite news failed: {res.data}"
    fav_news = res.get_json()["news"]
    print(f"Test 10: Favorite stocks news passed! Received {len(fav_news)} articles:")
    for n in fav_news:
        print(f"   - [{n.get('symbol')} | {n.get('sentiment')}] {n.get('title')[:60]}... ({n.get('publisher')})")

    # 11. Test Remove Favorite Stock
    res = client.delete("/api/user/favorites/NVDA", headers=headers)
    assert res.status_code == 200
    favs_after = res.get_json()["favorites"]
    assert "NVDA" not in favs_after
    print("Test 11: Remove favorite stock passed!")

    # 12. Test System Status Endpoint
    res = client.get("/api/system/status")
    assert res.status_code == 200
    status_data = res.get_json()
    print(f"Test 12: System status: Mongo connected={status_data['mongo']['connected']}, Redis={status_data['redis']}")

    print("\nALL 12 BACKEND TESTS PASSED SUCCESSFULLY! [OK]")

if __name__ == "__main__":
    run_tests()
