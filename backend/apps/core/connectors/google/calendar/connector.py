"""
Google Calendar Connector implementation.

Provides Google Calendar integration with event management capabilities.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger
from ..auth import get_google_service, refresh_google_token

logger = get_logger(__name__)


class GoogleCalendarConnector(BaseConnector):
    """
    Google Calendar Connector for managing calendar events.

    Supports OAuth 2.0 authentication with automatic token refresh.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize Google Calendar connector"""
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
            logger.error(f"Failed to load Google Calendar connector manifest: {str(e)}")
            return {
                "id": "google-calendar",
                "name": "Google Calendar",
                "version": "1.0.0",
                "description": "Manage calendar events via Google Calendar API",
                "author": "Bridge.dev",
                "connector_type": "action",
                "actions": [],
            }

    def _initialize(self) -> None:
        """Initialize Google Calendar service"""
        try:
            scopes = [
                "https://www.googleapis.com/auth/calendar",
                "https://www.googleapis.com/auth/calendar.events",
            ]
            self.config = refresh_google_token(self.config, scopes)

            self.service = get_google_service(self.config, "calendar", "v3")

            # Test connection by getting calendar list
            calendar_list = self.service.calendarList().list(maxResults=1).execute()

            logger.info(
                "Google Calendar connector initialized successfully",
                extra={"calendars_count": len(calendar_list.get("items", []))},
            )
        except Exception as e:
            logger.error(f"Failed to initialize Google Calendar service: {str(e)}")
            raise

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Google Calendar action.

        Args:
            action_id: Action ID
            inputs: Action inputs

        Returns:
            Dictionary with action outputs
        """
        action_map = {
            "create_event": self._execute_create_event,
            "get_event": self._execute_get_event,
            "list_events": self._execute_list_events,
            "update_event": self._execute_update_event,
            "delete_event": self._execute_delete_event,
            "list_calendars": self._execute_list_calendars,
            "find_free_busy": self._execute_find_free_busy,
        }

        if action_id not in action_map:
            raise ValueError(f"Unknown action: {action_id}")

        return action_map[action_id](inputs)

    def _build_event_body(
        self,
        summary: str,
        start_time: str,
        end_time: str,
        description: Optional[str] = None,
        location: Optional[str] = None,
        timezone: str = "UTC",
        attendees: Optional[List[str]] = None,
        reminders: Optional[List[Dict]] = None,
        recurrence: Optional[List[str]] = None,
        visibility: str = "default",
    ) -> Dict[str, Any]:
        """Build event body for create/update operations"""
        event = {
            "summary": summary,
            "start": {
                "dateTime": start_time,
                "timeZone": timezone,
            },
            "end": {
                "dateTime": end_time,
                "timeZone": timezone,
            },
            "visibility": visibility,
        }

        if description:
            event["description"] = description

        if location:
            event["location"] = location

        if attendees:
            event["attendees"] = [{"email": email} for email in attendees]

        if reminders:
            event["reminders"] = {"useDefault": False, "overrides": reminders}

        if recurrence:
            event["recurrence"] = recurrence

        return event

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
    )
    def _execute_create_event(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new calendar event"""
        calendar_id = inputs.get("calendar_id", "primary")
        summary = inputs.get("summary")
        start_time = inputs.get("start_time")
        end_time = inputs.get("end_time")

        if not summary:
            raise ValueError("summary is required")
        if not start_time:
            raise ValueError("start_time is required")
        if not end_time:
            raise ValueError("end_time is required")

        logger.info(
            f"Creating calendar event: {summary}",
            extra={"calendar_id": calendar_id, "summary": summary},
        )

        event_body = self._build_event_body(
            summary=summary,
            start_time=start_time,
            end_time=end_time,
            description=inputs.get("description"),
            location=inputs.get("location"),
            timezone=inputs.get("timezone", "UTC"),
            attendees=inputs.get("attendees"),
            reminders=inputs.get("reminders"),
            recurrence=inputs.get("recurrence"),
            visibility=inputs.get("visibility", "default"),
        )

        send_notifications = inputs.get("send_notifications", True)

        try:
            event = (
                self.service.events()
                .insert(
                    calendarId=calendar_id,
                    body=event_body,
                    sendNotifications=send_notifications,
                )
                .execute()
            )

            result = {
                "id": event.get("id"),
                "html_link": event.get("htmlLink"),
                "status": event.get("status"),
                "created": event.get("created"),
            }

            logger.info(
                f"Created event {result['id']}", extra={"event_id": result["id"]}
            )
            return result

        except Exception as e:
            error_msg = f"Failed to create calendar event: {str(e)}"
            logger.error(error_msg, extra={"error": str(e)})
            raise Exception(error_msg)

    def _execute_get_event(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Get a specific calendar event"""
        calendar_id = inputs.get("calendar_id", "primary")
        event_id = inputs.get("event_id")

        if not event_id:
            raise ValueError("event_id is required")

        logger.info(f"Getting event {event_id}", extra={"event_id": event_id})

        try:
            event = (
                self.service.events()
                .get(calendarId=calendar_id, eventId=event_id)
                .execute()
            )

            return {
                "id": event.get("id"),
                "summary": event.get("summary"),
                "description": event.get("description"),
                "location": event.get("location"),
                "start": event.get("start"),
                "end": event.get("end"),
                "attendees": event.get("attendees", []),
                "html_link": event.get("htmlLink"),
                "status": event.get("status"),
            }

        except Exception as e:
            error_msg = f"Failed to get event: {str(e)}"
            logger.error(error_msg, extra={"event_id": event_id, "error": str(e)})
            raise Exception(error_msg)

    def _execute_list_events(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """List calendar events"""
        calendar_id = inputs.get("calendar_id", "primary")
        time_min = inputs.get("time_min")
        time_max = inputs.get("time_max")
        max_results = inputs.get("max_results", 10)
        query = inputs.get("query")
        single_events = inputs.get("single_events", True)
        order_by = inputs.get("order_by", "startTime")

        logger.info(
            f"Listing events from calendar {calendar_id}",
            extra={"calendar_id": calendar_id},
        )

        try:
            params = {
                "calendarId": calendar_id,
                "maxResults": max_results,
                "singleEvents": single_events,
            }

            if time_min:
                params["timeMin"] = time_min
            else:
                # Default to now
                params["timeMin"] = datetime.utcnow().isoformat() + "Z"

            if time_max:
                params["timeMax"] = time_max

            if query:
                params["q"] = query

            if single_events:
                params["orderBy"] = order_by

            events_result = self.service.events().list(**params).execute()
            events = events_result.get("items", [])

            result = {
                "events": [
                    {
                        "id": event.get("id"),
                        "summary": event.get("summary"),
                        "description": event.get("description"),
                        "location": event.get("location"),
                        "start": event.get("start"),
                        "end": event.get("end"),
                        "html_link": event.get("htmlLink"),
                    }
                    for event in events
                ],
                "count": len(events),
            }

            logger.info(f"Listed {len(events)} events", extra={"count": len(events)})
            return result

        except Exception as e:
            error_msg = f"Failed to list events: {str(e)}"
            logger.error(error_msg, extra={"calendar_id": calendar_id, "error": str(e)})
            raise Exception(error_msg)

    def _execute_update_event(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing calendar event"""
        calendar_id = inputs.get("calendar_id", "primary")
        event_id = inputs.get("event_id")

        if not event_id:
            raise ValueError("event_id is required")

        logger.info(f"Updating event {event_id}", extra={"event_id": event_id})

        try:
            # Get existing event first
            existing_event = (
                self.service.events()
                .get(calendarId=calendar_id, eventId=event_id)
                .execute()
            )

            # Update fields
            if inputs.get("summary"):
                existing_event["summary"] = inputs["summary"]
            if inputs.get("description") is not None:
                existing_event["description"] = inputs["description"]
            if inputs.get("location") is not None:
                existing_event["location"] = inputs["location"]
            if inputs.get("start_time"):
                existing_event["start"] = {
                    "dateTime": inputs["start_time"],
                    "timeZone": inputs.get(
                        "timezone",
                        existing_event.get("start", {}).get("timeZone", "UTC"),
                    ),
                }
            if inputs.get("end_time"):
                existing_event["end"] = {
                    "dateTime": inputs["end_time"],
                    "timeZone": inputs.get(
                        "timezone", existing_event.get("end", {}).get("timeZone", "UTC")
                    ),
                }
            if inputs.get("attendees"):
                existing_event["attendees"] = [
                    {"email": email} for email in inputs["attendees"]
                ]

            send_notifications = inputs.get("send_notifications", True)

            updated_event = (
                self.service.events()
                .update(
                    calendarId=calendar_id,
                    eventId=event_id,
                    body=existing_event,
                    sendNotifications=send_notifications,
                )
                .execute()
            )

            result = {
                "id": updated_event.get("id"),
                "html_link": updated_event.get("htmlLink"),
                "status": updated_event.get("status"),
                "updated": updated_event.get("updated"),
            }

            logger.info(f"Updated event {event_id}", extra={"event_id": event_id})
            return result

        except Exception as e:
            error_msg = f"Failed to update event: {str(e)}"
            logger.error(error_msg, extra={"event_id": event_id, "error": str(e)})
            raise Exception(error_msg)

    def _execute_delete_event(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Delete a calendar event"""
        calendar_id = inputs.get("calendar_id", "primary")
        event_id = inputs.get("event_id")
        send_notifications = inputs.get("send_notifications", True)

        if not event_id:
            raise ValueError("event_id is required")

        logger.info(f"Deleting event {event_id}", extra={"event_id": event_id})

        try:
            self.service.events().delete(
                calendarId=calendar_id,
                eventId=event_id,
                sendNotifications=send_notifications,
            ).execute()

            result = {"success": True, "deleted_event_id": event_id}

            logger.info(f"Deleted event {event_id}", extra={"event_id": event_id})
            return result

        except Exception as e:
            error_msg = f"Failed to delete event: {str(e)}"
            logger.error(error_msg, extra={"event_id": event_id, "error": str(e)})
            raise Exception(error_msg)

    def _execute_list_calendars(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """List all accessible calendars"""
        show_hidden = inputs.get("show_hidden", False)

        logger.info("Listing calendars", extra={"show_hidden": show_hidden})

        try:
            calendar_list = (
                self.service.calendarList().list(showHidden=show_hidden).execute()
            )

            calendars = calendar_list.get("items", [])

            result = {
                "calendars": [
                    {
                        "id": cal.get("id"),
                        "summary": cal.get("summary"),
                        "description": cal.get("description"),
                        "timezone": cal.get("timeZone"),
                        "access_role": cal.get("accessRole"),
                        "primary": cal.get("primary", False),
                    }
                    for cal in calendars
                ],
                "count": len(calendars),
            }

            logger.info(
                f"Listed {len(calendars)} calendars", extra={"count": len(calendars)}
            )
            return result

        except Exception as e:
            error_msg = f"Failed to list calendars: {str(e)}"
            logger.error(error_msg, extra={"error": str(e)})
            raise Exception(error_msg)

    def _execute_find_free_busy(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Check free/busy availability"""
        time_min = inputs.get("time_min")
        time_max = inputs.get("time_max")
        calendar_ids = inputs.get("calendar_ids", ["primary"])
        timezone = inputs.get("timezone", "UTC")

        if not time_min:
            raise ValueError("time_min is required")
        if not time_max:
            raise ValueError("time_max is required")

        logger.info(
            f"Checking free/busy for {len(calendar_ids)} calendars",
            extra={"calendar_ids": calendar_ids},
        )

        try:
            body = {
                "timeMin": time_min,
                "timeMax": time_max,
                "timeZone": timezone,
                "items": [{"id": cal_id} for cal_id in calendar_ids],
            }

            freebusy_result = self.service.freebusy().query(body=body).execute()

            result = {"calendars": freebusy_result.get("calendars", {})}

            logger.info(
                "Free/busy query completed",
                extra={"calendars": len(result["calendars"])},
            )
            return result

        except Exception as e:
            error_msg = f"Failed to query free/busy: {str(e)}"
            logger.error(error_msg, extra={"error": str(e)})
            raise Exception(error_msg)
