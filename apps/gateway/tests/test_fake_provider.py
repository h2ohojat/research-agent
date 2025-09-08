from apps.gateway.service import get_provider

def test_fake_provider_stream():
    p = get_provider()  # باید FakeProvider برگردد
    msgs = [{"role": "user", "content": "سلام دنیا"}]
    events = list(p.generate(messages=msgs, model="fake-1", stream=True))

    assert events[0]["type"] == "started"
    # باید حداقل یک token بدهد
    token_events = [e for e in events if e["type"] == "token"]
    assert len(token_events) >= 1
    assert events[-1]["type"] == "done"
