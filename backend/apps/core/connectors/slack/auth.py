"""
Slack authentication helpers.

Handles OAuth token refresh and API key validation.
"""
from typing import Dict, Any
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


def get_slack_client(config: Dict[str, Any]):
    """
    Get Slack WebClient instance from config.
    
    Args:
        config: Configuration dictionary containing auth credentials
        
    Returns:
        slack_sdk.WebClient instance
        
    Raises:
        ValueError: If no valid authentication found
    """
    from slack_sdk import WebClient
    
    # Check for bot token (xoxb-*)
    bot_token = config.get('bot_token') or config.get('api_key')
    if bot_token:
        if not bot_token.startswith('xoxb-'):
            logger.warning("Bot token should start with 'xoxb-'")
        return WebClient(token=bot_token)
    
    # Check for OAuth access token
    access_token = config.get('access_token')
    if access_token:
        return WebClient(token=access_token)
    
    raise ValueError(
        "No valid Slack authentication found. "
        "Provide either 'bot_token'/'api_key' or 'access_token' in credentials."
    )


def refresh_oauth_token(refresh_token: str, client_id: str, client_secret: str) -> Dict[str, Any]:
    """
    Refresh OAuth access token.
    
    Args:
        refresh_token: OAuth refresh token
        client_id: OAuth client ID
        client_secret: OAuth client secret
        
    Returns:
        Dictionary with new access_token and optionally refresh_token
        
    Raises:
        Exception: If token refresh fails
    """
    import requests
    
    url = 'https://slack.com/api/oauth.v2.access'
    data = {
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
        'client_id': client_id,
        'client_secret': client_secret
    }
    
    try:
        response = requests.post(url, data=data)
        response.raise_for_status()
        result = response.json()
        
        if not result.get('ok'):
            error = result.get('error', 'unknown_error')
            raise Exception(f"Token refresh failed: {error}")
        
        return {
            'access_token': result.get('access_token'),
            'refresh_token': result.get('refresh_token', refresh_token),
            'expires_in': result.get('expires_in', 3600)
        }
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to refresh Slack OAuth token: {str(e)}")
        raise Exception(f"Token refresh request failed: {str(e)}")


