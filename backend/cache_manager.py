import os
import time
import json
import redis

REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")

class CacheManager:
    def __init__(self, redis_url=REDIS_URL):
        self.redis_url = redis_url
        self.redis_client = None
        self._memory_cache = {}  # key -> (value_json, expire_at)
        self._init_redis()

    def _init_redis(self):
        try:
            client = redis.from_url(
                self.redis_url,
                socket_timeout=1.5,
                socket_connect_timeout=1.5,
                decode_responses=True
            )
            # Test ping
            client.ping()
            self.redis_client = client
            print(f"Redis Cache connected successfully at {self.redis_url}")
        except Exception as e:
            self.redis_client = None
            print(f"Redis not available ({e}). Using in-memory TTL fallback cache.")

    def is_redis_active(self):
        if self.redis_client:
            try:
                return self.redis_client.ping()
            except Exception:
                self.redis_client = None
                return False
        return False

    def get_status(self):
        active = self.is_redis_active()
        return {
            "type": "redis" if active else "in_memory_fallback",
            "connected": active,
            "url": self.redis_url
        }

    def get(self, key):
        if self.redis_client:
            try:
                val = self.redis_client.get(key)
                if val is not None:
                    return json.loads(val)
                return None
            except Exception as e:
                # Redis query failed; fall back to memory
                pass

        # In-memory lookup
        item = self._memory_cache.get(key)
        if not item:
            return None
        val_str, expire_at = item
        if expire_at is not None and time.time() > expire_at:
            del self._memory_cache[key]
            return None
        try:
            return json.loads(val_str)
        except Exception:
            return val_str

    def set(self, key, value, ex=None):
        val_str = json.dumps(value)
        if self.redis_client:
            try:
                self.redis_client.set(key, val_str, ex=ex)
                return True
            except Exception:
                pass

        # In-memory set
        expire_at = (time.time() + ex) if ex else None
        self._memory_cache[key] = (val_str, expire_at)
        return True

    def delete(self, *keys):
        if not keys:
            return
        if self.redis_client:
            try:
                self.redis_client.delete(*keys)
            except Exception:
                pass
        for k in keys:
            self._memory_cache.pop(k, None)

    def delete_pattern(self, pattern):
        if self.redis_client:
            try:
                matched_keys = self.redis_client.keys(pattern)
                if matched_keys:
                    self.redis_client.delete(*matched_keys)
            except Exception:
                pass
        
        prefix = pattern.replace("*", "")
        keys_to_delete = [k for k in self._memory_cache if k.startswith(prefix)]
        for k in keys_to_delete:
            del self._memory_cache[k]


# Global cache instance
cache = CacheManager()
