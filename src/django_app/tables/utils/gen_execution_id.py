from datetime import datetime
import uuid
def gen_execution_id():
    now = datetime.now()
    short_uuid = str(uuid.uuid4())[:4]
    formatted_time = now.strftime(
        f"%d-%m-%Y_%H-%M-%S-{now.microsecond // 1000:03d}"
    )
    return f"{formatted_time}@{short_uuid}"
