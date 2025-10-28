import logging
from pydantic import BaseModel, Field
from langchain_community.tools.ddg_search.tool import DuckDuckGoSearchRun

logger = logging.getLogger(__name__)

class DuckDuckGoSearchSchema(BaseModel):
    """Input schema for DuckDuckGoSearchRun."""
    query: str = Field(..., description="The search query to perform.")

def main(query: str):
    tool = DuckDuckGoSearchRun(args_schema=DuckDuckGoSearchSchema)
    response = tool.run(query=query)
    return response
