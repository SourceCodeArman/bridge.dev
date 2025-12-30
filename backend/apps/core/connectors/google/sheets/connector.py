"""
Google Sheets Connector implementation.

Provides Google Sheets integration with read, write, append, and clear capabilities.
"""
from typing import Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger
from ..auth import get_sheets_service, refresh_google_token

logger = get_logger(__name__)


class GoogleSheetsConnector(BaseConnector):
    """
    Google Sheets Connector for reading and writing spreadsheet data.
    
    Supports OAuth 2.0 authentication with automatic token refresh.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize Google Sheets connector"""
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
            logger.error(f"Failed to load Google Sheets connector manifest: {str(e)}")
            # Return minimal manifest
            return {
                'id': 'google_sheets',
                'name': 'Google Sheets',
                'version': '1.0.0',
                'description': 'Read and write data to Google Sheets',
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
                        }
                    ]
                },
                'actions': [
                    {
                        'id': 'read_range',
                        'name': 'Read Range',
                        'description': 'Read data from a sheet range',
                        'input_schema': {
                            'type': 'object',
                            'required': ['spreadsheet_id', 'range'],
                            'properties': {
                                'spreadsheet_id': {
                                    'type': 'string',
                                    'description': 'Google Sheets spreadsheet ID'
                                },
                                'range': {
                                    'type': 'string',
                                    'description': 'Range to read (e.g., "Sheet1!A1:B10")'
                                }
                            }
                        },
                        'output_schema': {
                            'type': 'object',
                            'properties': {
                                'values': {
                                    'type': 'array',
                                    'items': {
                                        'type': 'array',
                                        'items': {'type': 'string'}
                                    },
                                    'description': 'Array of rows, each row is an array of cell values'
                                }
                            }
                        },
                        'required_fields': ['spreadsheet_id', 'range']
                    }
                ]
            }
    
    def _initialize(self) -> None:
        """Initialize Google Sheets service"""
        try:
            # Refresh token if needed before initializing
            scopes = ['https://www.googleapis.com/auth/spreadsheets']
            self.config = refresh_google_token(self.config, scopes)
            
            self.service = get_sheets_service(self.config)
            
            logger.info("Google Sheets connector initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Google Sheets service: {str(e)}")
            raise
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception)
    )
    def _execute_api_call(self, call_func, *args, **kwargs):
        """
        Execute API call with retry logic.
        
        Args:
            call_func: Function to call
            *args: Positional arguments
            **kwargs: Keyword arguments
            
        Returns:
            API response
        """
        try:
            return call_func(*args, **kwargs).execute()
        except Exception as e:
            error_str = str(e).lower()
            # Retry on quota errors
            if 'quota' in error_str or 'rate limit' in error_str:
                logger.warning(f"Google Sheets quota/rate limit hit, retrying: {str(e)}")
                raise  # Trigger retry
            else:
                logger.error(f"Google Sheets API call failed: {str(e)}")
                raise
    
    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Google Sheets action.
        
        Args:
            action_id: Action ID ('read_range', 'write_range', 'append_rows', 'clear_range')
            inputs: Action inputs
            
        Returns:
            Dictionary with action outputs
        """
        if action_id == 'read_range':
            return self._execute_read_range(inputs)
        elif action_id == 'write_range':
            return self._execute_write_range(inputs)
        elif action_id == 'append_rows':
            return self._execute_append_rows(inputs)
        elif action_id == 'clear_range':
            return self._execute_clear_range(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")
    
    def _execute_read_range(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute read_range action.
        
        Args:
            inputs: Action inputs (spreadsheet_id, range)
            
        Returns:
            Dictionary with values array
        """
        spreadsheet_id = inputs.get('spreadsheet_id')
        if not spreadsheet_id:
            raise ValueError("spreadsheet_id is required")
        
        range_name = inputs.get('range')
        if not range_name:
            raise ValueError("range is required")
        
        logger.info(
            f"Reading Google Sheets range",
            extra={'spreadsheet_id': spreadsheet_id, 'range': range_name}
        )
        
        try:
            result = self._execute_api_call(
                self.service.spreadsheets().values().get,
                spreadsheetId=spreadsheet_id,
                range=range_name
            )
            
            values = result.get('values', [])
            
            logger.info(
                f"Read {len(values)} rows from Google Sheets",
                extra={'spreadsheet_id': spreadsheet_id, 'row_count': len(values)}
            )
            
            return {'values': values}
            
        except Exception as e:
            error_msg = f"Failed to read Google Sheets range: {str(e)}"
            logger.error(error_msg, extra={'spreadsheet_id': spreadsheet_id, 'range': range_name, 'error': str(e)})
            raise Exception(error_msg)
    
    def _execute_write_range(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute write_range action.
        
        Args:
            inputs: Action inputs (spreadsheet_id, range, values)
            
        Returns:
            Dictionary with updated cells count
        """
        spreadsheet_id = inputs.get('spreadsheet_id')
        if not spreadsheet_id:
            raise ValueError("spreadsheet_id is required")
        
        range_name = inputs.get('range')
        if not range_name:
            raise ValueError("range is required")
        
        values = inputs.get('values')
        if not values:
            raise ValueError("values is required")
        
        if not isinstance(values, list):
            raise ValueError("values must be an array of rows")
        
        logger.info(
            f"Writing to Google Sheets range",
            extra={'spreadsheet_id': spreadsheet_id, 'range': range_name, 'row_count': len(values)}
        )
        
        try:
            body = {
                'values': values
            }
            
            result = self._execute_api_call(
                self.service.spreadsheets().values().update,
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption='RAW',
                body=body
            )
            
            updated_cells = result.get('updatedCells', 0)
            
            logger.info(
                f"Wrote {updated_cells} cells to Google Sheets",
                extra={'spreadsheet_id': spreadsheet_id, 'updated_cells': updated_cells}
            )
            
            return {
                'updated_cells': updated_cells,
                'updated_range': result.get('updatedRange')
            }
            
        except Exception as e:
            error_msg = f"Failed to write Google Sheets range: {str(e)}"
            logger.error(error_msg, extra={'spreadsheet_id': spreadsheet_id, 'range': range_name, 'error': str(e)})
            raise Exception(error_msg)
    
    def _execute_append_rows(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute append_rows action.
        
        Args:
            inputs: Action inputs (spreadsheet_id, range, values)
            
        Returns:
            Dictionary with appended rows info
        """
        spreadsheet_id = inputs.get('spreadsheet_id')
        if not spreadsheet_id:
            raise ValueError("spreadsheet_id is required")
        
        range_name = inputs.get('range')
        if not range_name:
            raise ValueError("range is required")
        
        values = inputs.get('values')
        if not values:
            raise ValueError("values is required")
        
        if not isinstance(values, list):
            raise ValueError("values must be an array of rows")
        
        logger.info(
            f"Appending rows to Google Sheets",
            extra={'spreadsheet_id': spreadsheet_id, 'range': range_name, 'row_count': len(values)}
        )
        
        try:
            body = {
                'values': values
            }
            
            result = self._execute_api_call(
                self.service.spreadsheets().values().append,
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption='RAW',
                insertDataOption='INSERT_ROWS',
                body=body
            )
            
            updated_cells = result.get('updates', {}).get('updatedCells', 0)
            updated_range = result.get('updates', {}).get('updatedRange')
            
            logger.info(
                f"Appended {len(values)} rows to Google Sheets",
                extra={'spreadsheet_id': spreadsheet_id, 'updated_cells': updated_cells}
            )
            
            return {
                'updated_cells': updated_cells,
                'updated_range': updated_range,
                'rows_appended': len(values)
            }
            
        except Exception as e:
            error_msg = f"Failed to append rows to Google Sheets: {str(e)}"
            logger.error(error_msg, extra={'spreadsheet_id': spreadsheet_id, 'range': range_name, 'error': str(e)})
            raise Exception(error_msg)
    
    def _execute_clear_range(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute clear_range action.
        
        Args:
            inputs: Action inputs (spreadsheet_id, range)
            
        Returns:
            Dictionary with cleared range info
        """
        spreadsheet_id = inputs.get('spreadsheet_id')
        if not spreadsheet_id:
            raise ValueError("spreadsheet_id is required")
        
        range_name = inputs.get('range')
        if not range_name:
            raise ValueError("range is required")
        
        logger.info(
            f"Clearing Google Sheets range",
            extra={'spreadsheet_id': spreadsheet_id, 'range': range_name}
        )
        
        try:
            result = self._execute_api_call(
                self.service.spreadsheets().values().clear,
                spreadsheetId=spreadsheet_id,
                range=range_name,
                body={}
            )
            
            cleared_range = result.get('clearedRange')
            
            logger.info(
                f"Cleared Google Sheets range",
                extra={'spreadsheet_id': spreadsheet_id, 'cleared_range': cleared_range}
            )
            
            return {
                'cleared_range': cleared_range
            }
            
        except Exception as e:
            error_msg = f"Failed to clear Google Sheets range: {str(e)}"
            logger.error(error_msg, extra={'spreadsheet_id': spreadsheet_id, 'range': range_name, 'error': str(e)})
            raise Exception(error_msg)


