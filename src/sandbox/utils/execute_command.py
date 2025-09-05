import asyncio

class ExecuteCommandException(Exception):
    def __init__(self, stdout, stderr, returncode):
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode

        message = (
            f"VenvException: returncode={returncode}, "
            f"stdout={stdout!r}, stderr={stderr!r}"
        )
        super().__init__(message)

async def execute_command(command) -> tuple[str, str]:
    process = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    stderr = stderr.decode("utf-8", errors="replace")
    stdout = stdout.decode("utf-8", errors="replace")
    returncode = process.returncode
    if returncode != 0:
        raise ExecuteCommandException(
            stderr=stderr, stdout=stdout, returncode=returncode
        )
    return stdout, stderr