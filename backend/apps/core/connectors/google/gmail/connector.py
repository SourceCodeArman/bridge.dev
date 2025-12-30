"""
Gmail Connector implementation.

Provides Gmail integration with email sending and reading capabilities.
"""
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger
from ..auth import get_gmail_service, refresh_google_token

logger = get_logger(__name__)


class GmailConnector(BaseConnector):
    """
    Gmail Connector for sending and reading emails.
    
    Supports OAuth 2.0 authentication with automatic token refresh.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize Gmail connector"""
        super().__init__(config)
        self.service = None
    
    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os
        manifest_path = os.path.join(
            os.path.dirname(__file__),
            'manifest.json'
        )
        try:
            with open(manifest_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load Gmail connector manifest: {str(e)}")
            # Return minimal manifest
            return {
                'id': 'gmail',
                'name': 'Gmail',
                'version': '1.0.0',
                'description': 'Send and read emails via Gmail API',
                'author': 'Bridge.dev',
                'connector_type': 'action',
                'auth_config': {
                    'type': 'oauth',
                    'fields': [
                        {
                            'name': 'access_token',
                            'type': 'password',
                            'required': True,
                            'description': 'OAuth access token'
                        },
                        {
                            'name': 'refresh_token',
                            'type': 'password',
                            'required': True,
                            'description': 'OAuth refresh token'
                        },
                        {
                            'name': 'client_id',
                            'type': 'string',
                            'required': False,
                            'description': 'OAuth client ID'
                        },
                        {
                            'name': 'client_secret',
                            'type': 'password',
                            'required': False,
                            'description': 'OAuth client secret'
                        }
                    ]
                },
                'actions': [
                    {
                        'id': 'send_email',
                        'name': 'Send Email',
                        'description': 'Send an email via Gmail',
                        'input_schema': {
                            'type': 'object',
                            'required': ['to', 'subject', 'body'],
                            'properties': {
                                'to': {
                                    'type': 'string',
                                    'description': 'Recipient email address'
                                },
                                'subject': {
                                    'type': 'string',
                                    'description': 'Email subject'
                                },
                                'body': {
                                    'type': 'string',
                                    'description': 'Email body (plain text or HTML)'
                                },
                                'cc': {
                                    'type': 'string',
                                    'description': 'CC email address (optional)'
                                },
                                'bcc': {
                                    'type': 'string',
                                    'description': 'BCC email address (optional)'
                                },
                                'is_html': {
                                    'type': 'boolean',
                                    'default': False,
                                    'description': 'Whether body is HTML'
                                }
                            }
                        },
                        'output_schema': {
                            'type': 'object',
                            'properties': {
                                'id': {
                                    'type': 'string',
                                    'description': 'Message ID'
                                },
                                'thread_id': {
                                    'type': 'string',
                                    'description': 'Thread ID'
                                }
                            }
                        },
                        'required_fields': ['to', 'subject', 'body']
                    }
                ]
            }
    
    def _initialize(self) -> None:
        """Initialize Gmail service"""
        try:
            # Refresh token if needed before initializing
            scopes = [
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.readonly'
            ]
            self.config = refresh_google_token(self.config, scopes)
            
            self.service = get_gmail_service(self.config)
            
            # Test connection by getting profile
            profile = self.service.users().getProfile(userId='me').execute()
            
            logger.info(
                "Gmail connector initialized successfully",
                extra={'email': profile.get('emailAddress')}
            )
        except Exception as e:
            logger.error(f"Failed to initialize Gmail service: {str(e)}")
            raise
    
    def _create_message(
        self,
        to: str,
        subject: str,
        body: str,
        cc: Optional[str] = None,
        bcc: Optional[str] = None,
        is_html: bool = False
    ) -> Dict[str, str]:
        """
        Create email message.
        
        Args:
            to: Recipient email
            subject: Email subject
            body: Email body
            cc: CC email (optional)
            bcc: BCC email (optional)
            is_html: Whether body is HTML
            
        Returns:
            Dictionary with 'raw' field containing base64-encoded message
        """
        message = MIMEMultipart('alternative')
        message['to'] = to
        message['subject'] = subject
        
        if cc:
            message['cc'] = cc
        if bcc:
            message['bcc'] = bcc
        
        # Add body
        if is_html:
            part = MIMEText(body, 'html')
        else:
            part = MIMEText(body, 'plain')
        
        message.attach(part)
        
        # Encode message
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
        
        return {'raw': raw_message}
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception)
    )
    def _send_message_with_retry(self, message: Dict[str, str]) -> Dict[str, Any]:
        """
        Send message with retry logic.
        
        Args:
            message: Message dictionary with 'raw' field
            
        Returns:
            Gmail API response
        """
        try:
            response = self.service.users().messages().send(
                userId='me',
                body=message
            ).execute()
            
            return response
            
        except Exception as e:
            error_str = str(e).lower()
            # Retry on quota errors
            if 'quota' in error_str or 'rate limit' in error_str:
                logger.warning(f"Gmail quota/rate limit hit, retrying: {str(e)}")
                raise  # Trigger retry
            else:
                logger.error(f"Gmail send failed: {str(e)}")
                raise
    
    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Gmail action.
        
        Args:
            action_id: Action ID ('send_email', 'read_emails', 'get_email')
            inputs: Action inputs
            
        Returns:
            Dictionary with action outputs
        """
        if action_id == 'send_email':
            return self._execute_send_email(inputs)
        elif action_id == 'read_emails':
            return self._execute_read_emails(inputs)
        elif action_id == 'get_email':
            return self._execute_get_email(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")
    
    def _execute_send_email(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute send_email action.
        
        Args:
            inputs: Action inputs (to, subject, body, etc.)
            
        Returns:
            Dictionary with id and thread_id
        """
        to = inputs.get('to')
        if not to:
            raise ValueError("to is required")
        
        subject = inputs.get('subject')
        if not subject:
            raise ValueError("subject is required")
        
        body = inputs.get('body')
        if not body:
            raise ValueError("body is required")
        
        cc = inputs.get('cc')
        bcc = inputs.get('bcc')
        is_html = inputs.get('is_html', False)
        
        logger.info(
            f"Sending Gmail email to {to}",
            extra={'to': to, 'subject': subject[:50]}
        )
        
        try:
            message = self._create_message(
                to=to,
                subject=subject,
                body=body,
                cc=cc,
                bcc=bcc,
                is_html=is_html
            )
            
            response = self._send_message_with_retry(message)
            
            result = {
                'id': response.get('id'),
                'thread_id': response.get('threadId')
            }
            
            logger.info(
                f"Gmail email sent successfully",
                extra={'message_id': result['id'], 'to': to}
            )
            
            return result
            
        except Exception as e:
            error_msg = f"Failed to send Gmail email: {str(e)}"
            logger.error(error_msg, extra={'to': to, 'error': str(e)})
            raise Exception(error_msg)
    
    def _execute_read_emails(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute read_emails action.
        
        Args:
            inputs: Action inputs (query, max_results)
            
        Returns:
            Dictionary with emails array
        """
        query = inputs.get('query', '')
        max_results = inputs.get('max_results', 10)
        
        logger.info(f"Reading Gmail emails", extra={'query': query, 'max_results': max_results})
        
        try:
            # List messages
            response = self.service.users().messages().list(
                userId='me',
                q=query,
                maxResults=max_results
            ).execute()
            
            messages = response.get('messages', [])
            
            # Get full message details
            emails = []
            for msg in messages:
                try:
                    msg_detail = self.service.users().messages().get(
                        userId='me',
                        id=msg['id'],
                        format='full'
                    ).execute()
                    
                    # Extract headers
                    headers = {h['name']: h['value'] for h in msg_detail.get('payload', {}).get('headers', [])}
                    
                    # Extract body
                    body = ''
                    payload = msg_detail.get('payload', {})
                    if 'parts' in payload:
                        for part in payload['parts']:
                            if part['mimeType'] == 'text/plain':
                                data = part['body'].get('data')
                                if data:
                                    body = base64.urlsafe_b64decode(data).decode('utf-8')
                                    break
                    else:
                        data = payload.get('body', {}).get('data')
                        if data:
                            body = base64.urlsafe_b64decode(data).decode('utf-8')
                    
                    emails.append({
                        'id': msg['id'],
                        'thread_id': msg_detail.get('threadId'),
                        'subject': headers.get('Subject', ''),
                        'from': headers.get('From', ''),
                        'to': headers.get('To', ''),
                        'date': headers.get('Date', ''),
                        'snippet': msg_detail.get('snippet', ''),
                        'body': body
                    })
                except Exception as e:
                    logger.warning(f"Failed to get message {msg['id']}: {str(e)}")
                    continue
            
            result = {
                'emails': emails,
                'count': len(emails)
            }
            
            logger.info(f"Read {len(emails)} Gmail emails", extra={'count': len(emails)})
            
            return result
            
        except Exception as e:
            error_msg = f"Failed to read Gmail emails: {str(e)}"
            logger.error(error_msg, extra={'error': str(e)})
            raise Exception(error_msg)
    
    def _execute_get_email(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute get_email action.
        
        Args:
            inputs: Action inputs (message_id)
            
        Returns:
            Dictionary with email details
        """
        message_id = inputs.get('message_id')
        if not message_id:
            raise ValueError("message_id is required")
        
        logger.info(f"Getting Gmail email {message_id}", extra={'message_id': message_id})
        
        try:
            msg_detail = self.service.users().messages().get(
                userId='me',
                id=message_id,
                format='full'
            ).execute()
            
            # Extract headers
            headers = {h['name']: h['value'] for h in msg_detail.get('payload', {}).get('headers', [])}
            
            # Extract body
            body = ''
            payload = msg_detail.get('payload', {})
            if 'parts' in payload:
                for part in payload['parts']:
                    if part['mimeType'] == 'text/plain':
                        data = part['body'].get('data')
                        if data:
                            body = base64.urlsafe_b64decode(data).decode('utf-8')
                            break
            else:
                data = payload.get('body', {}).get('data')
                if data:
                    body = base64.urlsafe_b64decode(data).decode('utf-8')
            
            result = {
                'id': msg_detail.get('id'),
                'thread_id': msg_detail.get('threadId'),
                'subject': headers.get('Subject', ''),
                'from': headers.get('From', ''),
                'to': headers.get('To', ''),
                'date': headers.get('Date', ''),
                'snippet': msg_detail.get('snippet', ''),
                'body': body
            }
            
            logger.info(f"Retrieved Gmail email {message_id}", extra={'message_id': message_id})
            
            return result
            
        except Exception as e:
            error_msg = f"Failed to get Gmail email: {str(e)}"
            logger.error(error_msg, extra={'message_id': message_id, 'error': str(e)})
            raise Exception(error_msg)


