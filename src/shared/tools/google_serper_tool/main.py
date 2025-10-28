import logging
from pydantic import BaseModel, Field
from langchain_community.tools.google_serper.tool import GoogleSerperRun

logger = logging.getLogger(__name__)

class GoogleSerperSearchSchema(BaseModel):
    """Input schema for GoogleSerperRun."""
    query: str = Field(..., description="The search query to perform.")

def main(query: str):
    tool = GoogleSerperRun(args_schema=GoogleSerperSearchSchema)
    response = tool.run(query=query)
    return response
