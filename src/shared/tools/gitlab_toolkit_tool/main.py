"""
This file contains the main entrypoint. 
It uses Pydantic to validate all possible arguments for the GitLab toolkit and then selects the correct tool based on the action field. 
Credentials (GITLAB_HOST and GITLAB_PRIVATE_ACCESS_TOKEN) are securely loaded from environment variables.
"""

import logging
import os
import json
from pydantic import BaseModel, Field
from typing import Optional, Literal, Dict, Any
from langchain_community.tools.gitlab.toolkit import GitlabToolkit

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define the precise set of actions available in the toolkit
GitlabAction = Literal[
    "get_project", 
    "get_projects_issues", 
    "get_project_issues_by_id",
    "create_project_issue", 
    "get_project_mrs", 
    "get_project_mrs_by_id",
    "create_project_mr", 
    "get_project_members", 
    "get_project_labels",
    "get_project_snippets", 
    "get_comments", 
    "create_comment"
]

class GitlabToolSchema(BaseModel):
    """
    Pydantic schema defining all possible arguments for the GitlabToolkit.
    The 'action' field determines which tool is called and which other
    fields are required.
    """
    action: GitlabAction = Field(
        ..., 
        description="The specific GitLab action to perform from the available tools."
    )
    
    project_id: Optional[str] = Field(
        None, 
        description="The ID or path of the GitLab project (e.g., '12345' or 'group/project'). Required for most actions."
    )
    issue_id: Optional[int] = Field(
        None, 
        description="The unique ID (iid) of a specific issue within a project."
    )
    mr_id: Optional[int] = Field(
        None, 
        description="The unique ID (iid) of a specific merge request within a project."
    )
    title: Optional[str] = Field(
        None, 
        description="The title for a new issue or merge request."
    )
    description: Optional[str] = Field(
        None, 
        description="The description body for a new issue or merge request."
    )
    source_branch: Optional[str] = Field(
        None, 
        description="The source branch for a new merge request."
    )
    target_branch: Optional[str] = Field(
        None, 
        description="The target branch for a new merge request."
    )
    object_type: Optional[Literal["issue", "mr"]] = Field(
        None, 
        description="The type of object to comment on (either 'issue' or 'mr')."
    )
    object_id: Optional[int] = Field(
        None, 
        description="The ID (iid) of the issue or MR to get/create comments for."
    )
    comment_body: Optional[str] = Field(
        None, 
        description="The text content of the comment to create."
    )


def main(action: str, **kwargs: Any) -> Any:
    """
    Main entrypoint for the GitLab Toolkit.

    This function initializes the GitlabToolkit, selects the appropriate tool
    based on the 'action' parameter, and executes it with the provided arguments.
    
    Credentials (GITLAB_HOST, GITLAB_PRIVATE_ACCESS_TOKEN) must be set
    as environment variables.
    """
    try:
        # 1. Validate inputs using Pydantic schema
        schema = GitlabToolSchema(action=action, **kwargs)
        logger.info(f"Executing action: {schema.action}")

        # 2. Get credentials from environment
        gitlab_host = os.environ.get("GITLAB_HOST", "https://gitlab.com")
        gitlab_token = os.environ.get("GITLAB_PRIVATE_ACCESS_TOKEN")

        if not gitlab_token:
            logger.error("GITLAB_PRIVATE_ACCESS_TOKEN environment variable is not set.")
            raise ValueError("GITLAB_PRIVATE_ACCESS_TOKEN environment variable is not set.")

        # 3. Initialize the Toolkit
        toolkit = GitlabToolkit(
            gitlab_host=gitlab_host,
            gitlab_private_access_token=gitlab_token
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
        # GitLab tools might return complex objects; we serialize them to strings
        # or return them directly if they are simple types.
        if isinstance(result, (str, dict, list, int, float, bool, type(None))):
            return result
        else:
            logger.warning(f"Tool returned non-serializable type: {type(result)}. Converting to string.")
            return str(result)

    except Exception as e:
        logger.error(f"Error executing GitLab tool: {e}", exc_info=True)
        # Return a JSON-serializable error message
        return {"error": f"An error occurred: {str(e)}"}