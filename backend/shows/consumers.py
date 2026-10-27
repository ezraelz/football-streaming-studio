import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
import uuid

from audit.groups import session_group


class SessionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope["url_route"]["kwargs"]["session_id"]
        self.group_name = session_group(self.session_id)

        allowed = await self.session_exists()
        if not allowed:
            await self.close()
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_initial_state()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def session_event(self, event):
        await self.send(text_data=json.dumps({"type": "session.update", "data": event["data"]}))

    async def send_initial_state(self):
        data = await database_sync_to_async(self._serialize)()
        if data is not None:
            await self.send(text_data=json.dumps({"type": "session.update", "data": data}))


    @database_sync_to_async
    def session_exists(self) -> bool:
        from .models import ShowSession
        try:
            uuid.UUID(str(self.session_id))
        except (ValueError, TypeError):
            return False
        return ShowSession.objects.filter(id=self.session_id).exists()


    def _serialize(self):
        from .models import ShowSession
        from .serializers import ShowSessionSerializer
        try:
            uuid.UUID(str(self.session_id))
        except (ValueError, TypeError):
            return None
        try:
            s = ShowSession.objects.select_related("show_profile", "match").get(id=self.session_id)
        except ShowSession.DoesNotExist:
            return None
        return ShowSessionSerializer(s).data

    async def log_event(self, event):
        await self.send(text_data=json.dumps({"type": "log.update", "data": event["data"]}))
        
    async def commentary_event(self, event):
        await self.send(text_data=json.dumps({"type": "commentary.update", "data": event["data"]}))
        
    async def scene_event(self, event):
        await self.send(text_data=json.dumps({"type": "scene.command", "data": event["data"]}))
        
    async def speech_event(self, event):
        await self.send(text_data=json.dumps({"type": "speech.ready", "data": event["data"]}))
        
    async def editorial_event(self, event):
        await self.send(text_data=json.dumps({"type": "editorial.update", "data": event["data"]}))
        