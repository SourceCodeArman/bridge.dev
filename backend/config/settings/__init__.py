"""
Settings package for Bridge.dev

This module loads the appropriate settings based on the DJANGO_SETTINGS_MODULE
environment variable. Defaults to dev.py for development.
"""
import os

# Determine which settings to use based on environment variable
# Default to dev for safety
ENV = os.environ.get('DJANGO_ENV', 'dev')

if ENV == 'prod':
    from .prod import *
else:
    from .dev import *

