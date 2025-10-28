import logging
from pydantic import BaseModel, Field
from typing import Optional
from langchain_community.tools.gmail.create_draft import GmailCreateDraft
from langchain_community.tools.gmail.send_message import GmailSendMessage
from langchain_community.tools.gmail.search import GmailSearch
from langchain_community.tools.gmail.get_message import GmailGetMessage
from langchain_community.tools.gmail.get_thread import GmailGetThread

logger = logging.getLogger(__name__)

class GmailToolSchema(BaseModel):
    """
    Input schema for Gmail tools. Depending on 'action', provide the required fields.
    """
    action: str = Field(
        ...,
        description="Which Gmail tool to execute: create_draft, send_message, search, get_message, get_thread"
    )
    # Fields for GmailCreateDraft and GmailSendMessage
    to: Optional[str] = Field(None, description="Recipient email address")
    subject: Optional[str] = Field(None, description="Email subject line")
    body: Optional[str] = Field(None, description="Email body content")
    # Fields for GmailSearch
    query: Optional[str] = Field(None, description="Search query string for Gmail messages")
    max_results: Optional[int] = Field(None, description="Maximum number of search results to return")
    # Fields for GmailGetMessage
    message_id: Optional[str] = Field(None, description="Unique Gmail message ID to retrieve")
    # Fields for GmailGetThread
    thread_id: Optional[str] = Field(None, description="Unique Gmail thread ID to retrieve")

def main(action: str, **kwargs):
    schema = GmailToolSchema(action=action, **kwargs)
    if action == "create_draft":
        tool = GmailCreateDraft(args_schema=schema)
        return tool.run(to=schema.to, subject=schema.subject, body=schema.body)
    elif action == "send_message":
        tool = GmailSendMessage(args_schema=schema)
        return tool.run(to=schema.to, subject=schema.subject, body=schema.body)
    elif action == "search":
        tool = GmailSearch(args_schema=schema)
        return tool.run(query=schema.query, max_results=schema.max_results)
    elif action == "get_message":
        tool = GmailGetMessage(args_schema=schema)
        return tool.run(message_id=schema.message_id)
    elif action == "get_thread":
        tool = GmailGetThread(args_schema=schema)
        return tool.run(thread_id=schema.thread_id)
    else:
        return {"error": "Unknown action"}
