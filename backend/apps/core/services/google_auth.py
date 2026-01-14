import google_auth_oauthlib.flow
from typing import Dict, Any, List
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class GoogleAuthService:
    """
    Service for handling Google OAuth flows with dynamic client credentials.
    """

    @staticmethod
    def get_flow(
        client_id: str, client_secret: str, scopes: List[str], redirect_uri: str
    ) -> google_auth_oauthlib.flow.Flow:
        """
        Create a Google OAuth flow instance.
        """
        client_config = {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        }

        return google_auth_oauthlib.flow.Flow.from_client_config(
            client_config, scopes=scopes, redirect_uri=redirect_uri
        )

    @classmethod
    def get_authorization_url(
        cls, client_id: str, client_secret: str, redirect_uri: str, scopes: List[str]
    ) -> str:
        """
        Generate the authorization URL for the user to visit.
        """
        flow = cls.get_flow(client_id, client_secret, scopes, redirect_uri)

        # Note: Do NOT use include_granted_scopes="true" as it combines with
        # previously granted scopes, causing scope mismatch errors
        authorization_url, _ = flow.authorization_url(
            access_type="offline", prompt="consent"
        )

        return authorization_url

    @classmethod
    def exchange_code_for_token(
        cls,
        client_id: str,
        client_secret: str,
        code: str,
        redirect_uri: str,
        scopes: List[str] = None,
    ) -> Dict[str, Any]:
        """
        Exchange the authorization code for an access token and refresh token.
        """
        # Scopes typically not needed for exchange step with this flow, but kept for signature consistency if needed later
        # or if we need to validate scopes.
        if scopes is None:
            raise ValueError("scopes must be provided for token exchange")

        flow = cls.get_flow(client_id, client_secret, scopes, redirect_uri)

        try:
            flow.fetch_token(code=code)
            credentials = flow.credentials

            return {
                "access_token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "token_uri": credentials.token_uri,
                "client_id": client_id,
                "client_secret": client_secret,
                "scopes": credentials.scopes,
            }
        except Exception as e:
            logger.error(f"Failed to exchange code for token: {str(e)}")
            raise Exception(f"Failed to exchange code for token: {str(e)}")
