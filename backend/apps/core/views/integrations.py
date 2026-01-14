from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.http import HttpResponse

from apps.core.services.google_auth import GoogleAuthService
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)

# Service-specific Google OAuth scopes
# Keys should match connector slugs (hyphen format)
GOOGLE_SCOPES = {
    "google-sheets": [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.readonly",  # For listing spreadsheets
    ],
    "google-calendar": [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
    ],
    "gmail": [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
    ],
    "google-drive": [
        "https://www.googleapis.com/auth/drive",
    ],
}


class IntegrationViewSet(viewsets.GenericViewSet):
    """
    ViewSet for handling external integration authentication flows.
    """

    permission_classes = [IsAuthenticated]

    @action(
        detail=False,
        methods=["get"],
        url_path="google/callback",
        permission_classes=[AllowAny],
    )
    def google_callback(self, request):
        """
        Handle Google OAuth callback.
        Returns an HTML page that posts the code back to the opener.
        """
        code = request.query_params.get("code")
        error = request.query_params.get("error")

        if error:
            content = f"""
            <script>
                window.opener.postMessage({{ type: 'oauth_error', error: '{error}' }}, '*');
                window.close();
            </script>
            """
        elif code:
            content = f"""
            <html>
            <body>
            <h1>Authentication successful. You can close this window.</h1>
            <script>
                console.log("OAuth Callback: Code received", "{code}");
                if (window.opener) {{
                    console.log("Sending message to opener");
                    window.opener.postMessage({{ type: 'oauth_callback', code: '{code}' }}, '*');
                    console.log("Message sent, closing window");
                    window.close();
                }} else {{
                    console.error("No window.opener found! Cannot complete auth.");
                    document.body.innerHTML += "<p style='color:red'>Error: Could not communicate with parent window. Please try again.</p>";
                }}
            </script>
            </body>
            </html>
            """
        else:
            content = """
            <script>
                window.opener.postMessage({ type: 'oauth_error', error: 'No code received' }, '*');
                window.close();
            </script>
            """

        response = HttpResponse(content, content_type="text/html")
        # Ensure the popup can communicate with the opener
        response["Cross-Origin-Opener-Policy"] = "unsafe-none"
        response["Cross-Origin-Embedder-Policy"] = "unsafe-none"
        return response

    @action(detail=False, methods=["post"], url_path="google/auth-url")
    def google_auth_url(self, request):
        """
        Generate Google OAuth authorization URL.
        """
        client_id = request.data.get("client_id")
        client_secret = request.data.get("client_secret")
        redirect_uri = request.data.get("redirect_uri")
        connector_type = request.data.get("connector_type", "google-calendar")

        if not all([client_id, client_secret, redirect_uri]):
            return Response(
                {"error": "client_id, client_secret, and redirect_uri are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Get scopes based on connector type
            scopes = GOOGLE_SCOPES.get(connector_type)
            if not scopes:
                return Response(
                    {
                        "error": f"Unknown connector type: {connector_type}. Valid types: {list(GOOGLE_SCOPES.keys())}"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            url = GoogleAuthService.get_authorization_url(
                client_id=client_id,
                client_secret=client_secret,
                redirect_uri=redirect_uri,
                scopes=scopes,
            )

            return Response({"url": url})

        except Exception as e:
            logger.error(f"Error generating auth URL: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="google/exchange")
    def google_exchange(self, request):
        """
        Exchange authorization code for tokens.
        """
        client_id = request.data.get("client_id")
        client_secret = request.data.get("client_secret")
        code = request.data.get("code")
        redirect_uri = request.data.get("redirect_uri")
        connector_type = request.data.get("connector_type", "google-calendar")

        if not all([client_id, client_secret, code, redirect_uri]):
            return Response(
                {
                    "error": "client_id, client_secret, code, and redirect_uri are required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Get scopes based on connector type - must match auth-url
            scopes = GOOGLE_SCOPES.get(connector_type)
            if not scopes:
                return Response(
                    {"error": f"Unknown connector type: {connector_type}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            tokens = GoogleAuthService.exchange_code_for_token(
                client_id=client_id,
                client_secret=client_secret,
                code=code,
                redirect_uri=redirect_uri,
                scopes=scopes,
            )

            return Response(tokens)

        except Exception as e:
            logger.error(f"Error exchanging token: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
