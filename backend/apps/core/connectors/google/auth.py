"""
Google OAuth authentication helpers.

Handles OAuth token refresh and credential management for Google APIs.
"""

from typing import Dict, Any, List
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


def get_google_credentials(config: Dict[str, Any], scopes: List[str]) -> Credentials:
    """
    Get Google OAuth credentials from config.

    Args:
        config: Configuration dictionary containing OAuth tokens
        scopes: List of OAuth scopes required

    Returns:
        google.oauth2.credentials.Credentials instance

    Raises:
        ValueError: If no valid credentials found
    """
    # Check for service account key (alternative auth method)
    service_account_key = config.get("service_account_key")
    if service_account_key:
        from google.oauth2 import service_account

        if isinstance(service_account_key, str):
            import json

            service_account_key = json.loads(service_account_key)

        credentials = service_account.Credentials.from_service_account_info(
            service_account_key, scopes=scopes
        )
        logger.info("Using Google service account credentials")
        return credentials

    # Check for OAuth credentials
    access_token = config.get("access_token")
    refresh_token = config.get("refresh_token")
    client_id = config.get("client_id")
    client_secret = config.get("client_secret")
    token_uri = config.get("token_uri", "https://oauth2.googleapis.com/token")

    if not access_token:
        raise ValueError(
            "No valid Google authentication found. "
            "Provide either 'service_account_key' or OAuth tokens ('access_token', 'refresh_token', etc.)"
        )

    # Create credentials object
    credentials = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret,
        scopes=scopes,
    )

    # Refresh token if expired
    if credentials.expired and credentials.refresh_token:
        try:
            credentials.refresh(Request())
            logger.info("Refreshed Google OAuth token")
        except Exception as e:
            logger.error(f"Failed to refresh Google OAuth token: {str(e)}")
            raise Exception(f"Token refresh failed: {str(e)}")

    return credentials


def refresh_google_token(config: Dict[str, Any], scopes: List[str]) -> Dict[str, Any]:
    """
    Refresh Google OAuth token and return updated config.

    Args:
        config: Current configuration with OAuth tokens
        scopes: List of OAuth scopes

    Returns:
        Updated config dictionary with new access_token

    Raises:
        Exception: If token refresh fails
    """
    try:
        credentials = get_google_credentials(config, scopes)

        # If credentials were refreshed, update config
        if credentials.token and credentials.token != config.get("access_token"):
            updated_config = config.copy()
            updated_config["access_token"] = credentials.token

            # Update refresh token if provided
            if credentials.refresh_token:
                updated_config["refresh_token"] = credentials.refresh_token

            logger.info("Google OAuth token refreshed successfully")
            return updated_config

        return config

    except Exception as e:
        logger.error(f"Failed to refresh Google OAuth token: {str(e)}")
        raise Exception(f"Token refresh failed: {str(e)}")


def get_gmail_service(config: Dict[str, Any]):
    """
    Get Gmail API service instance.

    Args:
        config: Configuration with OAuth credentials

    Returns:
        googleapiclient.discovery.Resource instance for Gmail API
    """
    scopes = [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
    ]

    credentials = get_google_credentials(config, scopes)
    service = build("gmail", "v1", credentials=credentials)

    return service


def get_sheets_service(config: Dict[str, Any]):
    """
    Get Google Sheets API service instance.

    Args:
        config: Configuration with OAuth credentials

    Returns:
        googleapiclient.discovery.Resource instance for Sheets API
    """
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]

    credentials = get_google_credentials(config, scopes)
    service = build("sheets", "v4", credentials=credentials)

    return service


def get_calendar_service(config: Dict[str, Any]):
    """
    Get Google Calendar API service instance.

    Args:
        config: Configuration with OAuth credentials

    Returns:
        googleapiclient.discovery.Resource instance for Calendar API
    """
    scopes = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
    ]

    credentials = get_google_credentials(config, scopes)
    service = build("calendar", "v3", credentials=credentials)

    return service


def get_google_service(config: Dict[str, Any], service_name: str, version: str):
    """
    Get a generic Google API service instance.

    Args:
        config: Configuration with OAuth credentials
        service_name: Name of the Google service (e.g., 'gmail', 'calendar', 'sheets')
        version: API version (e.g., 'v1', 'v3', 'v4')

    Returns:
        googleapiclient.discovery.Resource instance
    """
    # Map service names to their required scopes
    scope_map = {
        "gmail": [
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.readonly",
        ],
        "calendar": [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.events",
        ],
        "sheets": ["https://www.googleapis.com/auth/spreadsheets"],
        "drive": ["https://www.googleapis.com/auth/drive"],
    }

    scopes = scope_map.get(service_name, [])
    if not scopes:
        logger.warning(
            f"No default scopes for service {service_name}, using empty scopes"
        )

    credentials = get_google_credentials(config, scopes)
    service = build(service_name, version, credentials=credentials)

    return service
