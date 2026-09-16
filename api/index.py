import os
import sys

# Ensure backend directory is in python search path
base_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.abspath(os.path.join(base_dir, ".."))
backend_dir = os.path.join(parent_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import WSGI Flask app with full auth, db, redis cache, and news endpoints
from app import app

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
