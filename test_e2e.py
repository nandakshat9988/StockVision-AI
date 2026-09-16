import requests

BASE = "http://127.0.0.1:5000"
s = requests.Session()

print("--- 1. Testing Static Web Pages ---")
for path in ["/", "/index.html", "/stock.html", "/profile.html", "/auth.js", "/style.css"]:
    r = s.get(BASE + path)
    assert r.status_code == 200, f"Failed on {path}: {r.status_code}"
print("Static web pages served with 200 OK!")

print("\n--- 2. Testing Registration & JWT ---")
reg_data = {
    "username": "e2e_trader",
    "email": "e2e_trader@example.com",
    "password": "SecurePassword2026!"
}
r = s.post(BASE + "/api/auth/register", json=reg_data)
if r.status_code == 409:
    # login instead if user already exists
    r = s.post(BASE + "/api/auth/login", json={"emailOrUsername": "e2e_trader", "password": "SecurePassword2026!"})
assert r.status_code in [200, 201], f"Auth failed: {r.text}"
auth_resp = r.json()
token = auth_resp["token"]
user = auth_resp["user"]
print(f"Authenticated! User: {user['username']} ({user['email']}), Token: {token[:25]}...")

headers = {"Authorization": f"Bearer {token}"}

print("\n--- 3. Testing Favorites (MongoDB + Cache) ---")
# Add AAPL
r = s.post(BASE + "/api/user/favorites", json={"symbol": "AAPL"}, headers=headers)
assert r.status_code == 200
# Add NVDA
r = s.post(BASE + "/api/user/favorites", json={"symbol": "NVDA"}, headers=headers)
assert r.status_code == 200
r = s.get(BASE + "/api/user/favorites", headers=headers)
favs = r.json().get("favorites", [])
print("User Favorites in MongoDB:", favs)
assert "AAPL" in favs and "NVDA" in favs

print("\n--- 4. Testing Recent Stocks (MongoDB + Cache) ---")
r = s.post(BASE + "/api/user/recent", json={"symbol": "TSLA"}, headers=headers)
assert r.status_code == 200
r = s.get(BASE + "/api/user/recent", headers=headers)
recent = r.json().get("recent_stocks", [])
print("Recently Checked Stocks:", [item["symbol"] for item in recent])
assert any(item["symbol"] == "TSLA" for item in recent)

print("\n--- 5. Testing Profile Endpoint ---")
r = s.get(BASE + "/api/user/profile", headers=headers)
assert r.status_code == 200
prof = r.json()["profile"]
print("Profile Stats:", prof.get("stats"))
assert prof["stats"]["favoritesCount"] >= 2
assert prof["stats"]["recentCount"] >= 1

print("\n--- 6. Testing 3 Favorite Stocks News ---")
r = s.get(BASE + "/api/user/favorite-news?limit=3", headers=headers)
assert r.status_code == 200
fav_news = r.json().get("news", [])
print(f"Fetched {len(fav_news)} news for favorites:")
for idx, item in enumerate(fav_news, 1):
    print(f"  {idx}. [{item.get('symbol')} | {item.get('sentiment')}] {item.get('title')[:60]}... ({item.get('publisher')})")
assert len(fav_news) == 3, f"Expected 3 news for favorites, got {len(fav_news)}"

print("\n--- 7. Testing 3 Top Stock Market News ---")
r = s.get(BASE + "/api/news/top?limit=3")
assert r.status_code == 200
top_news = r.json().get("news", [])
print(f"Fetched {len(top_news)} top market news:")
for idx, item in enumerate(top_news, 1):
    print(f"  {idx}. [{item.get('sentiment')}] {item.get('title')[:60]}... ({item.get('publisher')})")
assert len(top_news) == 3, f"Expected 3 top market news, got {len(top_news)}"

print("\n--- 8. Testing Remove Favorite ---")
r = s.delete(BASE + "/api/user/favorites/NVDA", headers=headers)
assert r.status_code == 200
favs_after = r.json().get("favorites", [])
assert "NVDA" not in favs_after
print("Removed NVDA. Current Favorites in MongoDB:", favs_after)

print("\n=== ALL END-TO-END TESTS PASSED ON LIVE SERVER! [OK] ===")
