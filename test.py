import os
from dotenv import load_dotenv

load_dotenv()

print(os.environ.get("UI_SHOW_SHARE_BUTTON", "true").lower())
print(os.environ.get("UI_SHOW_SHARE_BUTTON", "true").lower() == "true")
print(os.environ.get("UI_SHOW_HISTORY_BUTTON", "true").lower() == "true")
