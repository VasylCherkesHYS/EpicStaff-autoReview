import logging
from pydantic import BaseModel, Field
from langchain_community.tools.agentql import AgentQL

logger = logging.getLogger(__name__)

class AgentQLSchema(BaseModel):
    """Input schema for AgentQL."""
    query: str = Field(..., description="AgentQL query string")

def main():
    tool = AgentQL(args_schema=AgentQLSchema)
    response = tool.run(query="extract headlines from news website")
    return response
