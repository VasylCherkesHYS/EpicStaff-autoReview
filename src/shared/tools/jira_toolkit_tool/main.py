"""
This file contains the main entrypoint. 
It defines a comprehensive Pydantic schema for all Jira actions, 
loads credentials from environment variables, 
and routes the request to the correct tool 
based on the action field.
"""

import logging
import os
import json
from pydantic import BaseModel, Field
from typing import Optional, Literal, Dict, Any, List
from langchain_community.tools.jira.toolkit import JiraToolkit

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define the precise set of actions available in the toolkit
JiraAction = Literal[
    "create_issue",
    "search_issues",
    "get_projects",
    "create_project",
    "get_issue",
    "update_issue",
    "add_comment",
    "get_comments",
    "assign_issue",
    "transition_issue",
    "get_all_users",
    "get_user_by_email"
]

class JiraToolSchema(BaseModel):
    """
    Pydantic schema defining all possible arguments for the JiraToolkit.
    The 'action' field determines which tool is called and which other
    fields are required by that specific tool.
    """
    action: JiraAction = Field(
        ..., 
        description="The specific Jira action to perform from the available tools."
    )
    
    # --- Parameters for Issue Creation/Search/Update ---
    project_key: Optional[str] = Field(
        None, 
        description="The key of the Jira project (e.g., 'PROJ'). Required for creating issues and projects."
    )
    summary: Optional[str] = Field(
        None, 
        description="The summary or title for a new issue."
    )
    description: Optional[str] = Field(
        None, 
        description="The description for a new issue. Can also be used for comment body."
    )
    issue_type: Optional[str] = Field(
        None, 
        description="The type of issue to create (e.g., 'Task', 'Bug', 'Story')."
    )
    jql_query: Optional[str] = Field(
        None, 
        description="A Jira Query Language (JQL) string to search for issues (e.g., 'project = PROJ AND status = Open')."
    )
    
    # --- Parameters for Specific Issue Operations ---
    issue_key: Optional[str] = Field(
        None, 
        description="The key of a specific Jira issue (e.g., 'PROJ-123'). Required for getting, updating, commenting, assigning, or transitioning issues."
    )
    update_fields: Optional[Dict[str, Any]] = Field(
        None, 
        description="A JSON dictionary of fields to update on an issue (e.g., {\"summary\": \"New summary\"})."
    )
    comment_body: Optional[str] = Field(
        None, 
        description="The text content for a new comment to add to an issue."
    )
    assignee_email: Optional[str] = Field(
        None, 
        description="The email address of the user to assign an issue to."
    )
    transition_name: Optional[str] = Field(
        None, 
        description="The name of the workflow transition to perform (e.g., 'In Progress', 'Done', 'Close Issue')."
    )
    
    # --- Parameters for Project Creation ---
    project_name: Optional[str] = Field(
        None, 
        description="The full name for a new project to be created."
    )
    project_template: Optional[str] = Field(
        None, 
        description="The template for a new project (e.g., 'kanban', 'scrum')."
    )
    
    # --- Parameters for User Search ---
    user_email: Optional[str] = Field(
        None, 
        description="The email address of a specific user to retrieve."
    )


def main(action: str, **kwargs: Any) -> Any:
    """
    Main entrypoint for the Jira Toolkit.

    This function initializes the JiraToolkit using credentials from environment
    variables, selects the appropriate tool based on the 'action' parameter,
    and executes it with the provided arguments.
    
    Credentials (JIRA_USERNAME, JIRA_API_TOKEN, JIRA_INSTANCE_URL) must be set
    as environment variables.
    """
    try:
        # 1. Validate inputs using Pydantic schema
        schema = JiraToolSchema(action=action, **kwargs)
        logger.info(f"Executing action: {schema.action}")

        # 2. Get credentials from environment
        jira_username = os.environ.get("JIRA_USERNAME")
        jira_api_token = os.environ.get("JIRA_API_TOKEN")
        jira_instance_url = os.environ.get("JIRA_INSTANCE_URL")

        if not all([jira_username, jira_api_token, jira_instance_url]):
            logger.error("Jira environment variables are not set.")
            raise ValueError("Missing required Jira environment variables (JIRA_USERNAME, JIRA_API_TOKEN, JIRA_INSTANCE_URL).")

        # 3. Initialize the Toolkit
        toolkit = JiraToolkit(
            username=jira_username,
            api_token=jira_api_token,
            instance_url=jira_instance_url
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
        # We pass all validated kwargs (except 'action') as a single dictionary,
        # as expected by the BaseTool.run() method.
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
        logger.error(f"Error executing Jira tool: {e}", exc_info=True)
        # Return a JSON-serializable error message
        return {"error": f"An error occurred: {str(e)}"}