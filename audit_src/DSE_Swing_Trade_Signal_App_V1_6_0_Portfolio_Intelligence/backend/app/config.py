import os
DSE_STORAGE_MODE = os.getenv('DSE_STORAGE_MODE', 'sqlite').lower()
DSE_STORAGE_PATH = os.getenv('DSE_STORAGE_PATH', './storage')
DSE_DATABASE_PATH = os.getenv('DSE_DATABASE_PATH', os.path.join(DSE_STORAGE_PATH, 'dse_swing_v1.sqlite3'))
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', '8000'))
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
