"""
Slack Connector implementation.

Provides Slack integration with message sending and channel listing capabilities.
"""
from typing import Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger
from .auth import get_slack_client, refresh_oauth_token

logger = get_logger(__name__)


class SlackConnector(BaseConnector):
    """
    Slack Connector for sending messages and interacting with Slack.
    
    Supports both OAuth and API key (bot token) authentication.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize Slack connector"""
        super().__init__(config)
        self.client = None
    
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
            logger.error(f"Failed to load Slack connector manifest: {str(e)}")
            # Return minimal manifest
            return {
                'id': 'slack',
                'name': 'Slack',
                'version': '1.0.0',
                'description': 'Send messages to Slack channels and DMs',
                'author': 'Bridge.dev',
                'connector_type': 'action',
                'auth_config': {
                    'type': 'oauth',
                    'fields': [
                        {
                            'name': 'bot_token',
                            'type': 'password',
                            'required': False,
                            'description': 'Slack bot token (xoxb-*)'
                        },
                        {
                            'name': 'access_token',
                            'type': 'password',
                            'required': False,
                            'description': 'OAuth access token'
                        }
                    ]
                },
                'actions': [
                    {
                        'id': 'send_message',
                        'name': 'Send Message',
                        'description': 'Send a message to a Slack channel or DM',
                        'input_schema': {
                            'type': 'object',
                            'required': ['channel', 'text'],
                            'properties': {
                                'channel': {
                                    'type': 'string',
                                    'description': 'Channel ID (C1234567890) or channel name (#general)'
                                },
                                'text': {
                                    'type': 'string',
                                    'description': 'Message text'
                                },
                                'blocks': {
                                    'type': 'array',
                                    'description': 'Slack Block Kit blocks (optional)'
                                },
                                'thread_ts': {
                                    'type': 'string',
                                    'description': 'Thread timestamp to reply to (optional)'
                                }
                            }
                        },
                        'output_schema': {
                            'type': 'object',
                            'properties': {
                                'ts': {
                                    'type': 'string',
                                    'description': 'Message timestamp'
                                },
                                'channel': {
                                    'type': 'string',
                                    'description': 'Channel ID'
                                },
                                'message': {
                                    'type': 'object',
                                    'description': 'Full message object from Slack API'
                                }
                            }
                        },
                        'required_fields': ['channel', 'text']
                    }
                ]
            }
    
    def _initialize(self) -> None:
        """Initialize Slack client"""
        try:
            self.client = get_slack_client(self.config)
            # Test connection with auth.test
            response = self.client.auth_test()
            if not response['ok']:
                raise ValueError(f"Slack authentication failed: {response.get('error', 'unknown_error')}")
            
            logger.info(
                "Slack connector initialized successfully",
                extra={'team': response.get('team'), 'user': response.get('user')}
            )
        except Exception as e:
            logger.error(f"Failed to initialize Slack client: {str(e)}")
            raise
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception)
    )
    def _send_message_with_retry(
        self,
        channel: str,
        text: str,
        blocks: Optional[list] = None,
        thread_ts: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send message with retry logic for rate limits.
        
        Args:
            channel: Channel ID or name
            text: Message text
            blocks: Optional Block Kit blocks
            thread_ts: Optional thread timestamp
            
        Returns:
            Slack API response
            
        Raises:
            Exception: If message sending fails after retries
        """
        try:
            kwargs = {
                'channel': channel,
                'text': text
            }
            
            if blocks:
                kwargs['blocks'] = blocks
            
            if thread_ts:
                kwargs['thread_ts'] = thread_ts
            
            response = self.client.chat_postMessage(**kwargs)
            
            if not response['ok']:
                error = response.get('error', 'unknown_error')
                
                # Handle rate limiting
                if error == 'ratelimited':
                    retry_after = response.get('headers', {}).get('Retry-After', 1)
                    logger.warning(
                        f"Slack rate limit hit, retrying after {retry_after}s",
                        extra={'channel': channel, 'retry_after': retry_after}
                    )
                    raise Exception(f"Rate limited, retry after {retry_after}s")
                
                raise Exception(f"Slack API error: {error}")
            
            return response
            
        except Exception as e:
            # Check if it's a rate limit error
            error_str = str(e).lower()
            if 'ratelimited' in error_str or 'rate limit' in error_str:
                # Re-raise to trigger retry
                raise
            else:
                # Don't retry on other errors
                logger.error(f"Slack message send failed: {str(e)}", extra={'channel': channel})
                raise
    
    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Slack action.
        
        Args:
            action_id: Action ID ('send_message' or 'list_channels')
            inputs: Action inputs
            
        Returns:
            Dictionary with action outputs
        """
        if action_id == 'send_message':
            return self._execute_send_message(inputs)
        elif action_id == 'list_channels':
            return self._execute_list_channels(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")
    
    def _execute_send_message(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute send_message action.
        
        Args:
            inputs: Action inputs (channel, text, blocks, thread_ts)
            
        Returns:
            Dictionary with ts, channel, and message
        """
        channel = inputs.get('channel')
        if not channel:
            raise ValueError("channel is required")
        
        text = inputs.get('text')
        if not text:
            raise ValueError("text is required")
        
        blocks = inputs.get('blocks')
        thread_ts = inputs.get('thread_ts')
        
        logger.info(
            f"Sending Slack message to {channel}",
            extra={'channel': channel, 'has_blocks': blocks is not None}
        )
        
        try:
            response = self._send_message_with_retry(
                channel=channel,
                text=text,
                blocks=blocks,
                thread_ts=thread_ts
            )
            
            message = response.get('message', {})
            
            result = {
                'ts': message.get('ts') or response.get('ts'),
                'channel': response.get('channel'),
                'message': message
            }
            
            logger.info(
                f"Slack message sent successfully",
                extra={'channel': channel, 'ts': result['ts']}
            )
            
            return result
            
        except Exception as e:
            error_msg = f"Failed to send Slack message: {str(e)}"
            logger.error(error_msg, extra={'channel': channel, 'error': str(e)})
            raise Exception(error_msg)
    
    def _execute_list_channels(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute list_channels action.
        
        Args:
            inputs: Action inputs (types)
            
        Returns:
            Dictionary with channels array
        """
        types = inputs.get('types', ['public_channel'])
        if isinstance(types, str):
            types = [types]
        
        logger.info(f"Listing Slack channels", extra={'types': types})
        
        try:
            response = self.client.conversations_list(types=','.join(types))
            
            if not response['ok']:
                error = response.get('error', 'unknown_error')
                raise Exception(f"Slack API error: {error}")
            
            channels = response.get('channels', [])
            
            # Format channels for output
            formatted_channels = [
                {
                    'id': ch.get('id'),
                    'name': ch.get('name'),
                    'is_private': ch.get('is_private', False),
                    'is_archived': ch.get('is_archived', False)
                }
                for ch in channels
            ]
            
            result = {
                'channels': formatted_channels,
                'count': len(formatted_channels)
            }
            
            logger.info(
                f"Listed {len(formatted_channels)} Slack channels",
                extra={'count': len(formatted_channels)}
            )
            
            return result
            
        except Exception as e:
            error_msg = f"Failed to list Slack channels: {str(e)}"
            logger.error(error_msg, extra={'error': str(e)})
            raise Exception(error_msg)


