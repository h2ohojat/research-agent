# apps/chat/session_utils.py
from typing import List

SESSION_KEY = "guest_conversations"

def session_list(session) -> List[int]:
    try:
        lst = session.get(SESSION_KEY)
    except Exception:
        lst = None
    if not isinstance(lst, list):
        return []
    return lst

def session_is_allowed(session, conv_id: int) -> bool:
    return conv_id in session_list(session)

def session_allow(session, conv_id: int) -> None:
    try:
        lst = session_list(session)
        if conv_id not in lst:
            lst.append(conv_id)
            session[SESSION_KEY] = lst
            session.modified = True
    except Exception:
        # در WS اگر سشن نبود یا middleware نبود، نادیده بگیر
        pass
