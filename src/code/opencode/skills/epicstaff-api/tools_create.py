"""Tool create operations — create new Python code tools."""


from common import api_post, logger


def cmd_create_tool(args):
    """Create a new Python code tool."""
    logger.info("cmd_create_tool: name={}", args.name)
    name = args.name
    description = getattr(args, "description", "")
    code = ""
    if getattr(args, "code_file", None):
        with open(args.code_file) as f:
            code = f.read()

    payload = {
        "name": name,
        "description": description,
        "python_code": {"code": code, "libraries": []},
        "args_schema": {"type": "object", "properties": {}},
    }
    result = api_post("/python-code-tool/", payload)
    tid = result.get("id")
    msg = f"Created tool: [{tid}] {result.get('name')}"
    print(msg)
    logger.info(msg)
    if description:
        print(f"  description: {description}")
    if code:
        print(f"  code: {len(code)} chars")
    return result
