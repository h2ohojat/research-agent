import pytest
from channels.testing import WebsocketCommunicator
from pyamooz_ai.asgi import application

@pytest.mark.asyncio
async def test_ws_echo():
    comm = WebsocketCommunicator(application, "/ws/echo/")
    connected, _ = await comm.connect()
    assert connected

    # نخستین پیام خوش‌آمد
    msg = await comm.receive_json_from()
    assert msg.get("type") == "welcome"

    await comm.send_json_to({"hello": "world"})
    resp = await comm.receive_json_from()
    assert resp.get("echo") == {"hello": "world"}
    await comm.disconnect()
