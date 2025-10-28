"""
Office365 Toolkit Main Entrypoint

This script provides the main function to interact with the Office365 Toolkit.

Required Environment Variables:
- O365_CLIENT_ID: The Application (client) ID for your Azure AD App.
- O365_CLIENT_SECRET: The client secret for your Azure AD App.
- O365_TENANT_ID: The Directory (tenant) ID of your Azure AD App.
- O365_USER_PRINCIPAL_NAME: The user email to act on behalf of (e.g., 'user@example.com').
"""

import logging
import os
import json
from pydantic import BaseModel, Field
from typing import Optional, Literal, Dict, Any, List
from langchain_community.tools.office365.toolkit import Office365Toolkit

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define the precise set of actions available in the toolkit
O365Action = Literal[
    "search_emails",
    "send_email",
    "search_calendar_events",
    "create_calendar_event",
    "list_onedrive_files",
    "read_onedrive_file",
    "write_onedrive_file"
]

class Office365ToolSchema(BaseModel):
    """
    Pydantic schema defining all possible arguments for the Office365Toolkit.
    The 'action' field determines which tool is called.
    """
    action: O365Action = Field(
        ..., 
        description="The specific Office365 action to perform from the available tools."
    )
    
    # --- Parameters for Email ---
    query: Optional[str] = Field(
        None, 
        description="A search query string (e.g., 'from:boss@example.com'). Used by 'search_emails' and 'search_calendar_events'."
    )
    limit: Optional[int] = Field(
        10, 
        description="The maximum number of results to return. Used by 'search_emails' and 'search_calendar_events'."
    )
    subject: Optional[str] = Field(
        None, 
        description="The subject line. Used by 'send_email' and 'create_calendar_event'."
    )
    body: Optional[str] = Field(
        None, 
        description="The body content (HTML or text). Used by 'send_email' and 'create_calendar_event'."
    )
    to_recipients: Optional[List[str]] = Field(
        None, 
        description="A list of recipient email addresses. Used by 'send_email'."
    )
    cc_recipients: Optional[List[str]] = Field(
        None, 
        description="A list of CC recipient email addresses. Used by 'send_email'."
    )
    bcc_recipients: Optional[List[str]] = Field(
        None, 
        description="A list of BCC recipient email addresses. Used by 'send_email'."
    )
    folder_id: Optional[str] = Field(
        None, 
        description="The optional ID of a specific mail folder to search in. Used by 'search_emails'."
    )

    # --- Parameters for Calendar ---
    start_time: Optional[str] = Field(
        None, 
        description="The start time for an event or search range in ISO 8601 format (e.g., '2025-10-31T09:00:00')."
    )
    end_time: Optional[str] = Field(
        None, 
        description="The end time for an event or search range in ISO 8601 format (e.g., '2025-10-31T10:00:00')."
    )
    attendees: Optional[List[str]] = Field(
        None, 
        description="A list of attendee email addresses. Used by 'create_calendar_event'."
    )
    location: Optional[str] = Field(
        None, 
        description="The location of the event. Used by 'create_calendar_event'."
    )
    calendar_id: Optional[str] = Field(
        None, 
        description="The optional ID of a specific calendar to search. Used by 'search_calendar_events'."
    )
    
    # --- Parameters for OneDrive ---
    folder_path: Optional[str] = Field(
        None, 
        description="The path to a folder in OneDrive (e.g., 'Documents/Reports'). Used by 'list_onedrive_files'."
    )
    file_path: Optional[str] = Field(
        None, 
        description="The path to a file in OneDrive (e.g., 'Documents/report.txt'). Used by 'read_onedrive_file' and 'write_onedrive_file'."
    )
    content: Optional[str] = Field(
        None, 
        description="The string content to write to a file. Used by 'write_onedrive_file'."
    )


def main(action: str, **kwargs: Any) -> Any:
    """
    Main entrypoint for the Office365 Toolkit.

    This function initializes the Office365Toolkit using credentials from
    environment variables, selects the appropriate tool based on the 'action'
    parameter, and executes it.
    
    Credentials (O365_CLIENT_ID, O365_CLIENT_SECRET, O365_TENANT_ID,
    O365_USER_PRINCIPAL_NAME) must be set as environment variables.
    """
    try:
        # 1. Validate inputs using Pydantic schema
        schema = Office365ToolSchema(action=action, **kwargs)
        logger.info(f"Executing action: {schema.action}")

        # 2. Get user principal name from environment
        user_principal_name = os.environ.get("O365_USER_PRINCIPAL_NAME")
        if not user_principal_name:
            logger.error("O365_USER_PRINCIPAL_NAME environment variable is not set.")
            raise ValueError("O365_USER_PRINCIPAL_NAME environment variable is not set.")
        
        # Check for other required env vars (the O365 lib checks them,
        # but we can provide a clearer error)
        if not all([
            os.environ.get("O365_CLIENT_ID"),
            os.environ.get("O365_CLIENT_SECRET"),
            os.environ.get("O365_TENANT_ID")
        ]):
            logger.error("Missing O365_CLIENT_ID, O365_CLIENT_SECRET, or O365_TENANT_ID.")
            raise ValueError("Missing required Office365 environment variables.")

        # 3. Initialize the Toolkit
        # The toolkit uses 'authorization_code' flow which reads credentials
        # from O365_CLIENT_ID, O365_CLIENT_SECRET, and O365_TENANT_ID.
        toolkit = Office365Toolkit(
            auth_type="authorization_code",
            user_principal_name=user_principal_name
        )
        
        # 4. Get all tools and create a map for easy lookup
        tools = toolkit.get_tools()
        tool_map = {tool.name: tool for tool in tools}

        # 5. Select the specified tool
        selected_tool = tool_map.get(schema.action)
        if not selected_tool:
            available_actions = list(tool_map.keys())
            logger.error(f"Unknown action: {schema.action}. Available: {available_actions}")
            raise ValueError(f"Unknown action: {schema.action}. Available actions are: {available_actions}")

        # 6. Prepare arguments for the tool's run method
        run_args = schema.model_dump(exclude={"action"}, exclude_none=True)
        
        logger.info(f"Running tool '{schema.action}' with args: {run_args}")
        
        # 7. Execute the tool
        result = selected_tool.run(run_args)
        
        # 8. Ensure the result is JSON serializable
        if isinstance(result, (str, dict, list, int, float, bool, type(None))):
            return result
        else:
            logger.warning(f"Tool returned non-serializable type: {type(result)}. Converting to string.")
            return str(result)

    except Exception as e:
        logger.error(f"Error executing Office365 tool: {e}", exc_info=True)
        # Return a JSON-serializable error message
        return {"error": f"An error occurred: {str(e)}"}