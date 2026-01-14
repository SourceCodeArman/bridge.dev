"""
Google Sheets Connector implementation.

Provides Google Sheets integration with read, write, append, and clear capabilities.
"""

from typing import Optional
from typing import Dict, Any
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
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

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        try:
            with open(manifest_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load Google Sheets connector manifest: {str(e)}")
            # Return minimal manifest
            return {
                "id": "google_sheets",
                "name": "Google Sheets",
                "version": "1.0.0",
                "description": "Read and write data to Google Sheets",
                "author": "Bridge.dev",
                "connector_type": "action",
                "auth_config": {
                    "type": "oauth",
                    "fields": [
                        {
                            "name": "access_token",
                            "type": "password",
                            "required": True,
                            "description": "OAuth access token",
                        },
                        {
                            "name": "refresh_token",
                            "type": "password",
                            "required": True,
                            "description": "OAuth refresh token",
                        },
                    ],
                },
                "actions": [
                    {
                        "id": "read_range",
                        "name": "Read Range",
                        "description": "Read data from a sheet range",
                        "input_schema": {
                            "type": "object",
                            "required": ["spreadsheet_id", "range"],
                            "properties": {
                                "spreadsheet_id": {
                                    "type": "string",
                                    "description": "Google Sheets spreadsheet ID",
                                },
                                "range": {
                                    "type": "string",
                                    "description": 'Range to read (e.g., "Sheet1!A1:B10")',
                                },
                            },
                        },
                        "output_schema": {
                            "type": "object",
                            "properties": {
                                "values": {
                                    "type": "array",
                                    "items": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                    },
                                    "description": "Array of rows, each row is an array of cell values",
                                }
                            },
                        },
                        "required_fields": ["spreadsheet_id", "range"],
                    }
                ],
            }

    def _initialize(self) -> None:
        """Initialize Google Sheets service"""
        try:
            # Refresh token if needed before initializing (using combined scopes)
            from ..auth import GOOGLE_COMBINED_SCOPES

            self.config = refresh_google_token(self.config, GOOGLE_COMBINED_SCOPES)

            self.service = get_sheets_service(self.config)

            logger.info("Google Sheets connector initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Google Sheets service: {str(e)}")
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
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
            if "quota" in error_str or "rate limit" in error_str:
                logger.warning(
                    f"Google Sheets quota/rate limit hit, retrying: {str(e)}"
                )
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
        if action_id == "read_range":
            return self._execute_read_range(inputs)
        elif action_id == "write_range":
            return self._execute_write_range(inputs)
        elif action_id == "append_rows":
            return self._execute_append_rows(inputs)
        elif action_id == "clear_range":
            return self._execute_clear_range(inputs)
        elif action_id == "create_spreadsheet":
            return self._execute_create_spreadsheet(inputs)
        elif action_id == "add_worksheet":
            return self._execute_add_worksheet(inputs)
        elif action_id == "list_worksheets":
            return self._execute_list_worksheets(inputs)
        elif action_id == "list_spreadsheets":
            return self._execute_list_spreadsheets(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")

    def _build_full_range(
        self, worksheet_name: Optional[str], cell_range: Optional[str]
    ) -> str:
        """
        Build full range string from worksheet name and cell range.

        Args:
            worksheet_name: Name of the worksheet (e.g., "Sheet1")
            cell_range: Cell range (e.g., "A1:B10")

        Returns:
            Full range string (e.g., "Sheet1!A1:B10" or just "A1:B10")
        """
        if worksheet_name and cell_range:
            return f"{worksheet_name}!{cell_range}"
        elif worksheet_name:
            return worksheet_name
        elif cell_range:
            return cell_range
        else:
            return ""

    def _execute_read_range(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute read_range action.

        Args:
            inputs: Action inputs (spreadsheet_id, worksheet_name, range)

        Returns:
            Dictionary with values array
        """
        spreadsheet_id = inputs.get("spreadsheet_id")
        if not spreadsheet_id:
            raise ValueError("spreadsheet_id is required")

        worksheet_name = inputs.get("worksheet_name")
        cell_range = inputs.get("range")
        if not cell_range:
            raise ValueError("range is required")

        range_name = self._build_full_range(worksheet_name, cell_range)

        logger.info(
            "Reading Google Sheets range",
            extra={"spreadsheet_id": spreadsheet_id, "range": range_name},
        )

        try:
            result = self._execute_api_call(
                self.service.spreadsheets().values().get,
                spreadsheetId=spreadsheet_id,
                range=range_name,
            )

            values = result.get("values", [])

            logger.info(
                f"Read {len(values)} rows from Google Sheets",
                extra={"spreadsheet_id": spreadsheet_id, "row_count": len(values)},
            )

            return {"values": values}

        except Exception as e:
            error_msg = f"Failed to read Google Sheets range: {str(e)}"
            logger.error(
                error_msg,
                extra={
                    "spreadsheet_id": spreadsheet_id,
                    "range": range_name,
                    "error": str(e),
                },
            )
            raise Exception(error_msg)

    def _execute_write_range(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute write_range action.

        Args:
            inputs: Action inputs (spreadsheet_id, worksheet_name, range, values)

        Returns:
            Dictionary with updated cells count
        """
        spreadsheet_id = inputs.get("spreadsheet_id")
        if not spreadsheet_id:
            raise ValueError("spreadsheet_id is required")

        worksheet_name = inputs.get("worksheet_name")
        cell_range = inputs.get("range")
        if not cell_range:
            raise ValueError("range is required")

        range_name = self._build_full_range(worksheet_name, cell_range)

        values = inputs.get("values")
        if not values:
            raise ValueError("values is required")

        if not isinstance(values, list):
            raise ValueError("values must be an array of rows")

        # Handle flat array (single row) vs 2D array (multiple rows)
        # Google Sheets API expects [[row1], [row2], ...] format
        if values and not isinstance(values[0], list):
            # Wrap flat array as single row
            values = [values]

        logger.info(
            "Writing to Google Sheets range",
            extra={
                "spreadsheet_id": spreadsheet_id,
                "range": range_name,
                "row_count": len(values),
            },
        )

        try:
            body = {"values": values}

            result = self._execute_api_call(
                self.service.spreadsheets().values().update,
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption="RAW",
                body=body,
            )

            updated_cells = result.get("updatedCells", 0)

            logger.info(
                f"Wrote {updated_cells} cells to Google Sheets",
                extra={
                    "spreadsheet_id": spreadsheet_id,
                    "updated_cells": updated_cells,
                },
            )

            return {
                "updated_cells": updated_cells,
                "updated_range": result.get("updatedRange"),
            }

        except Exception as e:
            error_msg = f"Failed to write Google Sheets range: {str(e)}"
            logger.error(
                error_msg,
                extra={
                    "spreadsheet_id": spreadsheet_id,
                    "range": range_name,
                    "error": str(e),
                },
            )
            raise Exception(error_msg)

    def _execute_append_rows(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute append_rows action.

        Args:
            inputs: Action inputs (spreadsheet_id, worksheet_name, values)

        Returns:
            Dictionary with appended rows info
        """
        spreadsheet_id = inputs.get("spreadsheet_id")
        if not spreadsheet_id:
            raise ValueError("spreadsheet_id is required")

        worksheet_name = inputs.get("worksheet_name")
        # For append, we use the worksheet name as the range (appends to end)
        range_name = worksheet_name or "Sheet1"

        values = inputs.get("values")
        if not values:
            raise ValueError("values is required")

        if not isinstance(values, list):
            raise ValueError("values must be an array of rows")

        # Handle flat array (single row) vs 2D array (multiple rows)
        # Google Sheets API expects [[row1], [row2], ...] format
        if values and not isinstance(values[0], list):
            # Wrap flat array as single row
            values = [values]

        logger.info(
            "Appending rows to Google Sheets",
            extra={
                "spreadsheet_id": spreadsheet_id,
                "range": range_name,
                "row_count": len(values),
            },
        )

        try:
            body = {"values": values}

            result = self._execute_api_call(
                self.service.spreadsheets().values().append,
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption="RAW",
                insertDataOption="INSERT_ROWS",
                body=body,
            )

            updated_cells = result.get("updates", {}).get("updatedCells", 0)
            updated_range = result.get("updates", {}).get("updatedRange")

            logger.info(
                f"Appended {len(values)} rows to Google Sheets",
                extra={
                    "spreadsheet_id": spreadsheet_id,
                    "updated_cells": updated_cells,
                },
            )

            return {
                "updated_cells": updated_cells,
                "updated_range": updated_range,
                "rows_appended": len(values),
            }

        except Exception as e:
            error_msg = f"Failed to append rows to Google Sheets: {str(e)}"
            logger.error(
                error_msg,
                extra={
                    "spreadsheet_id": spreadsheet_id,
                    "range": range_name,
                    "error": str(e),
                },
            )
            raise Exception(error_msg)

    def _execute_clear_range(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute clear_range action.

        Args:
            inputs: Action inputs (spreadsheet_id, worksheet_name, range)

        Returns:
            Dictionary with cleared range info
        """
        spreadsheet_id = inputs.get("spreadsheet_id")
        if not spreadsheet_id:
            raise ValueError("spreadsheet_id is required")

        worksheet_name = inputs.get("worksheet_name")
        cell_range = inputs.get("range")
        if not cell_range:
            raise ValueError("range is required")

        range_name = self._build_full_range(worksheet_name, cell_range)

        logger.info(
            "Clearing Google Sheets range",
            extra={"spreadsheet_id": spreadsheet_id, "range": range_name},
        )

        try:
            result = self._execute_api_call(
                self.service.spreadsheets().values().clear,
                spreadsheetId=spreadsheet_id,
                range=range_name,
                body={},
            )

            cleared_range = result.get("clearedRange")

            logger.info(
                "Cleared Google Sheets range",
                extra={
                    "spreadsheet_id": spreadsheet_id,
                    "cleared_range": cleared_range,
                },
            )

            return {"cleared_range": cleared_range}

        except Exception as e:
            error_msg = f"Failed to clear Google Sheets range: {str(e)}"
            logger.error(
                error_msg,
                extra={
                    "spreadsheet_id": spreadsheet_id,
                    "range": range_name,
                    "error": str(e),
                },
            )
            raise Exception(error_msg)

    def _execute_create_spreadsheet(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute create_spreadsheet action.

        Args:
            inputs: Action inputs (title)

        Returns:
            Dictionary with spreadsheet ID and URL
        """
        title = inputs.get("title")
        if not title:
            raise ValueError("title is required")

        logger.info(f"Creating new Google Spreadsheet: {title}")

        try:
            spreadsheet = {"properties": {"title": title}}

            result = self._execute_api_call(
                self.service.spreadsheets().create,
                body=spreadsheet,
                fields="spreadsheetId,spreadsheetUrl",
            )

            logger.info(
                "Created Google Spreadsheet",
                extra={
                    "spreadsheet_id": result.get("spreadsheetId"),
                    "title": title,
                },
            )

            return {
                "spreadsheet_id": result.get("spreadsheetId"),
                "spreadsheet_url": result.get("spreadsheetUrl"),
            }

        except Exception as e:
            error_msg = f"Failed to create Google Spreadsheet: {str(e)}"
            logger.error(error_msg, extra={"title": title, "error": str(e)})
            raise Exception(error_msg)

    def _execute_add_worksheet(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute add_worksheet action.

        Args:
            inputs: Action inputs (spreadsheet_id, title)

        Returns:
            Dictionary with sheet ID and title
        """
        spreadsheet_id = inputs.get("spreadsheet_id")
        if not spreadsheet_id:
            raise ValueError("spreadsheet_id is required")

        title = inputs.get("title")
        if not title:
            raise ValueError("title is required")

        logger.info(
            "Adding worksheet to Google Spreadsheet",
            extra={"spreadsheet_id": spreadsheet_id, "title": title},
        )

        try:
            body = {
                "requests": [
                    {
                        "addSheet": {
                            "properties": {
                                "title": title,
                            }
                        }
                    }
                ]
            }

            result = self._execute_api_call(
                self.service.spreadsheets().batchUpdate,
                spreadsheetId=spreadsheet_id,
                body=body,
            )

            added_sheet = (
                result.get("replies", [])[0].get("addSheet", {}).get("properties", {})
            )

            logger.info(
                "Added worksheet to Google Spreadsheet",
                extra={
                    "spreadsheet_id": spreadsheet_id,
                    "sheet_id": added_sheet.get("sheetId"),
                    "title": added_sheet.get("title"),
                },
            )

            return {
                "sheet_id": added_sheet.get("sheetId"),
                "title": added_sheet.get("title"),
            }

        except Exception as e:
            error_msg = f"Failed to add worksheet to Google Spreadsheet: {str(e)}"
            logger.error(
                error_msg,
                extra={
                    "spreadsheet_id": spreadsheet_id,
                    "title": title,
                    "error": str(e),
                },
            )
            raise Exception(error_msg)

    def _execute_list_worksheets(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute list_worksheets action.

        Args:
            inputs: Action inputs (spreadsheet_id)

        Returns:
            Dictionary with list of worksheets
        """
        spreadsheet_id = inputs.get("spreadsheet_id")
        if not spreadsheet_id:
            raise ValueError("spreadsheet_id is required")

        logger.info(
            "Listing worksheets in Google Spreadsheet",
            extra={"spreadsheet_id": spreadsheet_id},
        )

        try:
            result = self._execute_api_call(
                self.service.spreadsheets().get,
                spreadsheetId=spreadsheet_id,
            )

            sheets = result.get("sheets", [])
            worksheets = []

            for sheet in sheets:
                props = sheet.get("properties", {})
                worksheets.append(
                    {
                        "sheet_id": props.get("sheetId"),
                        "title": props.get("title"),
                        "index": props.get("index"),
                    }
                )

            logger.info(
                f"Found {len(worksheets)} worksheets in Google Spreadsheet",
                extra={"spreadsheet_id": spreadsheet_id, "count": len(worksheets)},
            )

            return {"worksheets": worksheets}

        except Exception as e:
            error_msg = f"Failed to list worksheets in Google Spreadsheet: {str(e)}"
            logger.error(
                error_msg,
                extra={"spreadsheet_id": spreadsheet_id, "error": str(e)},
            )
            raise Exception(error_msg)

    def _execute_list_spreadsheets(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute list_spreadsheets action using Google Drive API.

        Args:
            inputs: Action inputs (optional max_results)

        Returns:
            Dictionary with list of spreadsheets
        """
        max_results = inputs.get("max_results", 50)

        logger.info("Listing Google Spreadsheets via Drive API")

        try:
            # Use Drive API to list spreadsheets
            from ..auth import get_google_credentials, GOOGLE_COMBINED_SCOPES
            from googleapiclient.discovery import build

            credentials = get_google_credentials(self.config, GOOGLE_COMBINED_SCOPES)
            drive_service = build("drive", "v3", credentials=credentials)

            # Query for Google Sheets files only
            query = (
                "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
            )

            result = (
                drive_service.files()
                .list(
                    q=query,
                    pageSize=max_results,
                    fields="files(id, name, createdTime, modifiedTime)",
                    orderBy="modifiedTime desc",
                )
                .execute()
            )

            files = result.get("files", [])
            spreadsheets = [
                {
                    "id": f.get("id"),
                    "name": f.get("name"),
                    "created_time": f.get("createdTime"),
                    "modified_time": f.get("modifiedTime"),
                }
                for f in files
            ]

            logger.info(
                f"Found {len(spreadsheets)} spreadsheets",
                extra={"count": len(spreadsheets)},
            )

            return {"spreadsheets": spreadsheets, "count": len(spreadsheets)}

        except Exception as e:
            error_msg = f"Failed to list spreadsheets: {str(e)}"
            logger.error(error_msg, extra={"error": str(e)})
            raise Exception(error_msg)
