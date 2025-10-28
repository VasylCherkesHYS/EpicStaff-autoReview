import logging
from pydantic import BaseModel, Field
from langchain_community.agent_toolkits.github.toolkit import GitHubToolkit

logger = logging.getLogger(__name__)

class GitHubActionSchema(BaseModel):
    """Schema for GitHub actions."""
    action: str = Field(..., description="The GitHub action to perform (e.g., 'create_issue', 'create_pull_request')")
    repo_owner: str = Field(..., description="The owner of the repository")
    repo_name: str = Field(..., description="The name of the repository")
    title: str = Field(..., description="Title for the issue or pull request")
    body: str = Field(..., description="Body content for the issue or pull request")
    assignees: list[str] = Field([], description="List of assignees for the issue or pull request")
    labels: list[str] = Field([], description="List of labels for the issue or pull request")

def main(action: str, repo_owner: str, repo_name: str, title: str, body: str, assignees: list[str] = [], labels: list[str] = []):
    tool = GitHubToolkit(args_schema=GitHubActionSchema)
    response = tool.run(action=action, repo_owner=repo_owner, repo_name=repo_name, title=title, body=body, assignees=assignees, labels=labels)
    return response
