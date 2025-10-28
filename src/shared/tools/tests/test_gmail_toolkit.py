import pytest
from pydantic import ValidationError
from unittest.mock import MagicMock


from gmail_toolkit_tool.main import main, GmailToolSchema



DRAFT_TOOL_PATH = "gmail_toolkit_tool.main.GmailCreateDraft"
SEND_TOOL_PATH = "gmail_toolkit_tool.main.GmailSendMessage"
SEARCH_TOOL_PATH = "gmail_toolkit_tool.main.GmailSearch"
GET_MSG_TOOL_PATH = "gmail_toolkit_tool.main.GmailGetMessage"
GET_THREAD_TOOL_PATH = "gmail_toolkit_tool.main.GmailGetThread"

@pytest.fixture
def mock_gmail_tools(mocker):

    mocks = {
        "create_draft": mocker.patch(DRAFT_TOOL_PATH),
        "send_message": mocker.patch(SEND_TOOL_PATH),
        "search": mocker.patch(SEARCH_TOOL_PATH),
        "get_message": mocker.patch(GET_MSG_TOOL_PATH),
        "get_thread": mocker.patch(GET_THREAD_TOOL_PATH),
    }

    for tool_mock in mocks.values():

        tool_mock.return_value.run = MagicMock(return_value=f"mocked {tool_mock} result")
    
    return mocks


def test_create_draft_success(mock_gmail_tools):
    args = {"to": "test@example.com", "subject": "Test", "body": "Hello"}
    
    result = main(action="create_draft", **args)

    mock_gmail_tools["create_draft"].assert_called_once()
    mock_gmail_tools["send_message"].assert_not_called()
    
    mock_run = mock_gmail_tools["create_draft"].return_value.run
    mock_run.assert_called_once_with(
        to="test@example.com", 
        subject="Test", 
        body="Hello"
    )
    
    assert "mocked" in result
    assert "GmailCreateDraft" in result

def test_send_message_success(mock_gmail_tools):
    args = {"to": "boss@work.com", "subject": "Done", "body": "Finished"}
    
    main(action="send_message", **args)
    
    mock_gmail_tools["send_message"].assert_called_once()
    mock_gmail_tools["search"].assert_not_called()
    
    mock_run = mock_gmail_tools["send_message"].return_value.run
    mock_run.assert_called_once_with(**args)

def test_search_success(mock_gmail_tools):
    args = {"query": "from:manager", "max_results": 5}
    
    main(action="search", **args)
    
    mock_gmail_tools["search"].assert_called_once()
    mock_gmail_tools["get_message"].assert_not_called()
    
    mock_run = mock_gmail_tools["search"].return_value.run
    mock_run.assert_called_once_with(query="from:manager", max_results=5)

def test_get_message_success(mock_gmail_tools):
    args = {"message_id": "msg-123"}
    
    main(action="get_message", **args)
    
    mock_gmail_tools["get_message"].assert_called_once()
    mock_gmail_tools["get_thread"].assert_not_called()
    
    mock_run = mock_gmail_tools["get_message"].return_value.run
    mock_run.assert_called_once_with(message_id="msg-123")

def test_get_thread_success(mock_gmail_tools):
    args = {"thread_id": "thread-abc"}
    
    main(action="get_thread", **args)
    
    mock_gmail_tools["get_thread"].assert_called_once()
    mock_gmail_tools["search"].assert_not_called()
    
    mock_run = mock_gmail_tools["get_thread"].return_value.run
    mock_run.assert_called_once_with(thread_id="thread-abc")

def test_unknown_action(mock_gmail_tools):
    result = main(action="delete_all_emails", please="dont")
    
    assert result == {"error": "Unknown action"}
    
    for tool_mock in mock_gmail_tools.values():
        tool_mock.assert_not_called()

def test_pydantic_validation_error():

    with pytest.raises(ValidationError):
        main(action="search", query="test", max_results="five")

    with pytest.raises(TypeError):
        main(query="test")