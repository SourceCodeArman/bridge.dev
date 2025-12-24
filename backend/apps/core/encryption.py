"""
Encryption utilities for credential storage.

Uses Fernet symmetric encryption to encrypt credentials at rest.
"""
from cryptography.fernet import Fernet
from django.conf import settings
import base64
import json
from typing import Dict, Any


class CredentialEncryption:
    """
    Service for encrypting and decrypting credential data.
    
    Uses Fernet symmetric encryption with a key stored in settings.
    """
    
    def __init__(self):
        """Initialize encryption service with key from settings."""
        encryption_key = getattr(settings, 'CREDENTIAL_ENCRYPTION_KEY', None)
        if not encryption_key:
            raise ValueError(
                'CREDENTIAL_ENCRYPTION_KEY must be set in settings. '
                'Generate a key using: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
            )
        
        # If key is a string, encode it
        if isinstance(encryption_key, str):
            encryption_key = encryption_key.encode()
        
        self.fernet = Fernet(encryption_key)
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext string.
        
        Args:
            plaintext: String to encrypt
            
        Returns:
            Base64-encoded encrypted string
        """
        if not plaintext:
            return ''
        
        encrypted_bytes = self.fernet.encrypt(plaintext.encode('utf-8'))
        return base64.b64encode(encrypted_bytes).decode('utf-8')
    
    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt ciphertext string.
        
        Args:
            ciphertext: Base64-encoded encrypted string
            
        Returns:
            Decrypted plaintext string
            
        Raises:
            ValueError: If decryption fails (invalid key or corrupted data)
        """
        if not ciphertext:
            return ''
        
        try:
            encrypted_bytes = base64.b64decode(ciphertext.encode('utf-8'))
            decrypted_bytes = self.fernet.decrypt(encrypted_bytes)
            return decrypted_bytes.decode('utf-8')
        except Exception as e:
            raise ValueError(f"Failed to decrypt credential data: {str(e)}")
    
    def encrypt_dict(self, data: Dict[str, Any]) -> str:
        """
        Encrypt a dictionary by converting to JSON first.
        
        Args:
            data: Dictionary to encrypt
            
        Returns:
            Base64-encoded encrypted JSON string
        """
        json_str = json.dumps(data)
        return self.encrypt(json_str)
    
    def decrypt_dict(self, ciphertext: str) -> Dict[str, Any]:
        """
        Decrypt ciphertext and parse as JSON dictionary.
        
        Args:
            ciphertext: Base64-encoded encrypted string
            
        Returns:
            Decrypted dictionary
            
        Raises:
            ValueError: If decryption or JSON parsing fails
        """
        json_str = self.decrypt(ciphertext)
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse decrypted data as JSON: {str(e)}")
    
    def rotate_key(self, old_key: bytes, new_key: bytes):
        """
        Rotate encryption key (for future key management).
        
        This would be used to re-encrypt all credentials with a new key.
        Not implemented in MVP - placeholder for future enhancement.
        
        Args:
            old_key: Old Fernet key
            new_key: New Fernet key
        """
        # TODO: Implement key rotation logic
        # This would require:
        # 1. Decrypt all credentials with old_key
        # 2. Re-encrypt with new_key
        # 3. Update all Credential records
        raise NotImplementedError("Key rotation not yet implemented")


# Global encryption service instance
_encryption_service = None


def get_encryption_service() -> CredentialEncryption:
    """
    Get or create the global encryption service instance.
    
    Returns:
        CredentialEncryption instance
    """
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = CredentialEncryption()
    return _encryption_service

