from celery import shared_task
from apps.chat.services import run_generation

@shared_task
def ping():
    return "pong"
@shared_task
def run_generation_task(message_id: int):
    run_generation(message_id)