import json
from channels.generic.websocket import AsyncWebsocketConsumer

from audit.groups import match_group


class MatchConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.group_name = match_group(self.match_id)

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send the initial state so the client doesn't have to fetch separately
        await self.send_initial_state()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def send_initial_state(self):
        from channels.db import database_sync_to_async
        from matches.services import build_overlay_payload
        payload = await database_sync_to_async(build_overlay_payload)(
            self.match_id, include_lineups=False
        )
        if payload is not None:
            await self.send(text_data=json.dumps({"type": "match.update", "data": payload}))

    # Handler for group_send events
    async def match_update(self, event):
        await self.send(text_data=json.dumps({"type": "match.update", "data": event["data"]}))