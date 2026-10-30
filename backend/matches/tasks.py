# matches/tasks.py
from celery import shared_task
from django.core.management import call_command
import logging

logger = logging.getLogger(__name__)

@shared_task
def poll_matches_task():
    try:
        call_command('poll_matches')
        logger.info("poll_matches completed successfully.")
    except Exception as e:
        logger.error(f"poll_matches failed: {e}")