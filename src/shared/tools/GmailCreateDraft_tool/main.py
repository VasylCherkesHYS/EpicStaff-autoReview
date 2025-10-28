import logging
from pydantic import BaseModel, Field
from langchain_community.tools.gmail.create_draft import GmailCreateDraft

logger = logging.getLogger(__name__)

class GmailCreateDraftSchema(BaseModel):
    """Input schema for GmailCreateDraft."""
    to: str = Field(..., description="Recipient email address")
    subject: str = Field(..., description="Subject of the email")
    body: str = Field(..., description="Body content of the email")

def main():
    tool = GmailCreateDraft(args_schema=GmailCreateDraftSchema)
    response = tool.run(to="example@example.com", subject="Test Subject", body="Test Body")
    return response
