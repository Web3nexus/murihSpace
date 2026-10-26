# End-to-end encrypted calls and livestreams

Status: client support and server flags are in place. Nothing turns encryption on by default yet. A page must pass an `e2ee` transport to `LiveKitVideoConference`. The Signal transport wiring is still open (see "Open items").

## Key flow

1. The host (initiator) creates a random 32-byte room key on their device (`createRoomKey`, WebCrypto).
2. The host sends the key to each participant through the existing one-to-one Signal session. The transport is the `E2eePeerTransport` interface in `frontend/src/lib/e2ee/roomKey.ts`: `sendToPeer(peerId, bytes)` and `onFromPeer(handler)`. Peer ids are LiveKit participant identities.
3. A participant who joins without the key sends a `req` to the others. A holder answers with the key only if `canShareWith` returns true. The component allows only participants who are currently in the LiveKit room.
4. The key is applied to LiveKit through `RoomKeyProvider` (a `BaseKeyProvider` subclass). Each key has a keyring slot (`gen mod 16`). Media is encrypted in a worker (`livekit-client/e2ee-worker`). Participants without the key cannot decode media.
5. When someone leaves, the lowest identity still present creates a new key and sends it to everyone who remains. The leaver never receives it, so later media is unreadable to them.

The server never receives the room key. The LiveKit token does not carry it. Keys are not stored in the backend or in browser storage.

## What the server can see

- Who joined and left a room, and when (`live_stream_participants`, `audio_room_participants`, and LiveKit's own room events).
- Room metadata: title, host, start and end times, viewer counts, the `e2ee` flag.
- Connection metadata that LiveKit sees: IP addresses, client versions, and the sizes and timing of encrypted packets.

## What the server cannot see

- Audio, video, or screen-share content. LiveKit forwards encrypted frames it cannot decrypt.
- The room key, or any key rotation material.
- Signal chat content used to deliver the key.

## Recording and HLS trade-off

Encrypted rooms cannot be recorded or transcoded on the server, because the server has no key. This is a deliberate trade-off.

- `App\Services\LiveKit\RoomRecordingPolicy` returns the reason `e2ee_room`. Audio room create and update drop `is_recorded` for an encrypted room and return `recording_skipped` with a message. They do not fail.
- `ProcessVideoHlsJob` converts uploaded `Media` files. It is not linked to any room, so it cannot see the room flag. The repo has no LiveKit egress or recording code today. If one is added, it must call `RoomRecordingPolicy::skipReason()` first.
- Hosts who need a replay must use an unencrypted room, or record on the client before the call.

## Data model

- Migration `2026_10_26_120000_add_e2ee_flag_to_live_rooms` adds `e2ee` (boolean, default false) to `live_streams` and `audio_rooms`.
- Meetings and coaching sessions have no database record, so their encryption choice is made on the client only.

## Open items

- The Signal `E2eePeerTransport` is not wired. `e2ee-bridge` (Rust, WebAssembly) has no JavaScript glue or key-directory integration in the frontend yet.
- The livestream viewer UI is not in this repo. Only the backend side exists.
- The UI does not show a "waiting for key" state for a participant who has not received the key yet.
- Rotation is decided locally, from the participant list each device sees. If two people leave at the same moment, two devices may each rotate. Receivers keep the newest key they got, but devices can end on different keys until the next join or leave. This needs a fix before a sensitive rollout.
- Key requests go to any participant currently in the LiveKit room. Anyone with a valid token can join, so the meeting code or booking is the real admission control.
