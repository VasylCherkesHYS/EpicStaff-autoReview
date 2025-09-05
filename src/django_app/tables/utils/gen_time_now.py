from datetime import datetime, timezone

def gen_time_now() -> str:
    """Generate the current time in ISO string format."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )