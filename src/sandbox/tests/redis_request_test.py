import json
from redis import Redis

r = Redis(host="localhost", port=6379, decode_responses=True)
p = r.pubsub()
r.publish("sandbox", json.dumps({"id": "test12", "type": "create_venv", "data":{"venv_name":"test12"}}))

