"""
Security policies for sandbox execution.

Defines network access policies and secret access policies.
"""
import re
from typing import List, Dict, Any, Optional, Set
from urllib.parse import urlparse
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class NetworkPolicy:
    """
    Network access policy for sandbox execution.
    
    Controls which domains/URLs can be accessed by connectors.
    """
    
    def __init__(
        self,
        allowed_domains: Optional[List[str]] = None,
        blocked_domains: Optional[List[str]] = None,
        allow_localhost: bool = False,
        allow_internal: bool = False
    ):
        """
        Initialize network policy.
        
        Args:
            allowed_domains: List of allowed domain patterns (wildcards supported)
            blocked_domains: List of blocked domain patterns
            allow_localhost: Allow localhost/127.0.0.1 access
            allow_internal: Allow internal/private network access
        """
        self.allowed_domains = allowed_domains or []
        self.blocked_domains = blocked_domains or []
        self.allow_localhost = allow_localhost
        self.allow_internal = allow_internal
        
        # Compile domain patterns for matching
        self._allowed_patterns = [self._compile_pattern(d) for d in self.allowed_domains]
        self._blocked_patterns = [self._compile_pattern(d) for d in self.blocked_domains]
    
    def _compile_pattern(self, pattern: str) -> re.Pattern:
        """
        Compile domain pattern to regex.
        
        Supports wildcards: *.example.com -> .*\.example\.com
        """
        # Escape special chars except *
        escaped = re.escape(pattern)
        # Replace \* with .*
        regex = escaped.replace(r'\*', '.*')
        # Anchor to domain boundaries
        return re.compile(f'^{regex}$', re.IGNORECASE)
    
    def is_allowed(self, url: str) -> bool:
        """
        Check if URL is allowed by policy.
        
        Args:
            url: URL to check
            
        Returns:
            True if allowed, False otherwise
        """
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname
            
            if not hostname:
                logger.warning(f"Invalid URL for network policy check: {url}")
                return False
            
            # Check blocked domains first
            for pattern in self._blocked_patterns:
                if pattern.match(hostname):
                    logger.debug(f"URL {url} blocked by pattern")
                    return False
            
            # Check if localhost/internal
            is_localhost = hostname in ['localhost', '127.0.0.1', '::1']
            is_internal = self._is_internal_ip(hostname)
            
            if is_localhost and not self.allow_localhost:
                logger.debug(f"URL {url} blocked: localhost not allowed")
                return False
            
            if is_internal and not self.allow_internal:
                logger.debug(f"URL {url} blocked: internal network not allowed")
                return False
            
            # If no allowed domains specified, allow all (except blocked/localhost/internal)
            if not self.allowed_domains:
                return True
            
            # Check allowed domains
            for pattern in self._allowed_patterns:
                if pattern.match(hostname):
                    logger.debug(f"URL {url} allowed by pattern")
                    return True
            
            logger.debug(f"URL {url} blocked: not in allowed domains")
            return False
            
        except Exception as e:
            logger.error(
                f"Error checking network policy for {url}: {str(e)}",
                exc_info=e
            )
            return False
    
    def _is_internal_ip(self, hostname: str) -> bool:
        """Check if hostname is an internal/private IP address"""
        # Check for private IP ranges
        private_patterns = [
            r'^10\.',
            r'^172\.(1[6-9]|2[0-9]|3[0-1])\.',
            r'^192\.168\.',
            r'^169\.254\.',  # Link-local
            r'^fc00:',  # IPv6 private
            r'^fe80:',  # IPv6 link-local
        ]
        
        for pattern in private_patterns:
            if re.match(pattern, hostname):
                return True
        
        return False
    
    def get_policy_dict(self) -> Dict[str, Any]:
        """Get policy as dictionary for logging"""
        return {
            'allowed_domains': self.allowed_domains,
            'blocked_domains': self.blocked_domains,
            'allow_localhost': self.allow_localhost,
            'allow_internal': self.allow_internal
        }


class SecretPolicy:
    """
    Secret access policy for sandbox execution.
    
    Controls which secrets can be accessed by connectors.
    """
    
    def __init__(
        self,
        allowed_secret_ids: Optional[Set[str]] = None,
        mask_in_logs: bool = True
    ):
        """
        Initialize secret policy.
        
        Args:
            allowed_secret_ids: Set of secret IDs that can be accessed
            mask_in_logs: Whether to mask secrets in logs
        """
        self.allowed_secret_ids = allowed_secret_ids or set()
        self.mask_in_logs = mask_in_logs
    
    def is_allowed(self, secret_id: str) -> bool:
        """
        Check if secret ID is allowed.
        
        Args:
            secret_id: Secret ID to check
            
        Returns:
            True if allowed, False otherwise
        """
        if not self.allowed_secret_ids:
            # If no restrictions, allow all
            return True
        
        return secret_id in self.allowed_secret_ids
    
    def mask_secret(self, value: Any) -> str:
        """
        Mask secret value for logging.
        
        Args:
            value: Secret value to mask
            
        Returns:
            Masked string
        """
        if not self.mask_in_logs:
            return str(value)
        
        if isinstance(value, str):
            if len(value) <= 4:
                return '****'
            return value[:2] + '****' + value[-2:]
        elif isinstance(value, dict):
            return '{****}'
        else:
            return '****'
    
    def get_policy_dict(self) -> Dict[str, Any]:
        """Get policy as dictionary for logging"""
        return {
            'allowed_secret_ids': list(self.allowed_secret_ids),
            'mask_in_logs': self.mask_in_logs,
            'allowed_count': len(self.allowed_secret_ids)
        }


