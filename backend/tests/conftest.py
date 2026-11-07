import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Tests never use real credentials or the developer database. Set before `app` is imported
# (python-dotenv does not override variables that are already set).
os.environ["OPENROUTER_API_KEY"] = ""
os.environ["OPENROUTER_MODEL"] = ""
os.environ["DATABASE_PATH"] = str(Path(tempfile.mkdtemp(prefix="rootd-test-")) / "test.sqlite3")
