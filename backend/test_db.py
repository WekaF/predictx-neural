
from services.db_service import db_service
import os
import time

print("--- Supabase Connection Test ---")
print(f"URL: {os.environ.get('VITE_SUPABASE_URL') or os.environ.get('SUPABASE_URL') or 'NOT FOUND'}")
key = os.environ.get('VITE_SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_KEY')
print(f"KEY: {'FOUND' if key else 'NOT FOUND'}")

if db_service.client:
    print("Client initialized. Attempting insert...")
    test_data = {
        "symbol": "TEST-BTC",
        "epochs": 1,
        "final_loss": 0.0,
        "status": "TEST_RUN",
        "duration_seconds": 1.5
    }
    result = db_service.log_training_session(test_data)
    if result:
        print("✅ Insert successful!")
        print(result)
    else:
        print("❌ Insert failed.")
else:
    print("❌ Client not initialized.")
