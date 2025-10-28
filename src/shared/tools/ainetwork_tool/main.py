import logging
from pydantic import BaseModel, Field
from langchain_community.tools.ainetwork.app import AINAppOps
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

logger = logging.getLogger(__name__)

class AINetworkToolSchema(BaseModel):
    """Schema for interacting with the AINetwork Blockchain."""
    action: str = Field(..., description="The operation to perform (e.g., 'transfer', 'create_app')")
    params: dict = Field(..., description="Parameters for the operation")
    context: str = Field(None, description="Optional instructions for the LLM")

def main(action: str, params: dict, context: str = None):
    tool = AINAppOps(args_schema=AINetworkToolSchema)
    response = tool.run(action=action, params=params, context=context)
    return response
