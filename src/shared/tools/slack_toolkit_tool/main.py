"""
Twilio Send Message Tool Main Entrypoint

This script provides the main function to send an SMS via Twilio.

Required Environment Variables:
- TWILIO_ACCOUNT_SID: Your Twilio Account SID.
- TWILIO_AUTH_TOKEN: Your Twilio Auth Token.
- TWILIO_FROM_NUMBER: Your Twilio phone number (e.g., '+15551234567').
"""

import logging
import os
import json
from pydantic import BaseModel, Field
from typing import Dict, Any
from langchain_community.tools.twilio import TwilioClien

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TwilioSendMsgSchema(BaseModel):
    """
    Pydantic schema for the Twilio send_message tool.
    """
    to_phone_number: str = Field(
        ..., 
        description="The recipient's phone number in E.164 format (e.g., '+15557654321')."
    )
    body: str = Field(
        ..., 
        description="The text content of the SMS message to send."
    )

def main(**kwargs: Any) -> Any:
    """
    Main entrypoint for the Twilio Send Message tool.
    
    This function initializes the TwilioClien using credentials from
    environment variables and sends a message using the provided arguments.
    """
    try:
        # 1. Validate inputs using Pydantic schema
        schema = TwilioSendMsgSchema(**kwargs)
        logger.info(f"Validated input for Twilio: {schema.model_dump_json()}")

        # 2. Get credentials from environment
        account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
        from_phone_number = os.environ.get("TWILIO_FROM_NUMBER")

        if not all([account_sid, auth_token, from_phone_number]):
            logger.error("Twilio environment variables are not set.")
            raise ValueError("Missing required Twilio environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).")

        # 3. Initialize the Tool
        tool = TwilioClien(
            account_sid=account_sid,
            auth_token=auth_token,
            from_phone_number=from_phone_number
        )
        
        # 4. Prepare arguments for the tool's run method
        # The run method expects kwargs matching the schema
        run_args = schema.model_dump()
        
        logger.info(f"Running tool 'send_message' with args: {run_args}")
        
        # 5. Execute the tool
        # The Langchain tool's run() method takes these specific kwargs
        result = tool.run(
            to_phone_number=schema.to_phone_number,
            body=schema.body
        )
        
        # 6. Ensure the result is JSON serializable
        if isinstance(result, (str, dict, list, int, float, bool, type(None))):
            return result
        else:
            logger.warning(f"Tool returned non-serializable type: {type(result)}. Converting to string.")
            return str(result)

    except Exception as e:
        logger.error(f"Error executing Twilio tool: {e}", exc_info=True)
        # Return a JSON-serializable error message
        return {"error": f"An error occurred: {str(e)}"}