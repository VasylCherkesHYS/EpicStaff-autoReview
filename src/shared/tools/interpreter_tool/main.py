from interpreter import interpreter

def main(command: str):
    if not command:
        return "Error: No command provided for executing. Please provide a command as the 'command' parameter."

    interpreter.auto_run = True
    interpreter.llm.context_window = 32768
    interpreter.anonymized_telemetry = False

    try:
        result = interpreter.chat(command)
        return str(result)
    except Exception as e:
        return f"Failed to execute command: {e}"
