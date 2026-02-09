from supabase import create_client, Client
import os
from dotenv import load_dotenv

from pathlib import Path

# Load .env.local from project root
# __file__ = backend/services/db_service.py
# parent = backend/services
# parent.parent = backend
# parent.parent.parent = project root
env_path = Path(__file__).resolve().parent.parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)

class DatabaseService:
    def __init__(self):
        self.url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
        self.key = os.environ.get("VITE_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_KEY")
        self.client: Client = None
        
        if self.url and self.key:
            try:
                self.client = create_client(self.url, self.key)
                print("✅ Connected to Supabase")
            except Exception as e:
                print(f"❌ Failed to connect to Supabase: {e}")
        else:
            print("⚠️ Supabase credentials not found. Cloud logging disabled.")

    def log_training_session(self, session_data: dict):
        """
        Log training session results to Supabase/training_sessions table.
        """
        if not self.client:
            return
            
        try:
            data, count = self.client.table("training_sessions").insert(session_data).execute()
            print(f"✅ Training session logged to Supabase: {session_data.get('id')}")
            return data
        except Exception as e:
            print(f"❌ Failed to log training session to Supabase: {e}")
            return None

    def get_training_history(self, limit: int = 50):
        if not self.client:
            return []
            
        try:
            response = self.client.table("training_sessions").select("*").order("created_at", desc=True).limit(limit).execute()
            return response.data
        except Exception as e:
            print(f"❌ Failed to fetch training history: {e}")
            return []

db_service = DatabaseService()
