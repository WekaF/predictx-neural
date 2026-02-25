import requests
import time
import hmac
import hashlib
from urllib.parse import urlencode

API_KEY = "WaBJscL1raLkhUB2KcyyiTxNguObcqeWYELLeTxkXvVZbJpygUxYQuvgbl9HQEjK"
API_SECRET = "Z9C6Bq9A3Jd5d6c8K076Z9C6Bq9A3Jd5d6c8K076Z9C6Bq9A3Jd5d6c8K076" # Replace with actual secret if known, or we just test the proxy

# Testing through proxy
print("Testing proxy")
