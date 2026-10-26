# End-to-end encrypted group chats

Status: implemented in `e2ee-bridge` (sender keys) and the backend (epochs, envelopes, send/read rules). Scope is group conversations (`conversations.type = 'group'`). Direct chats keep the pairwise `signal_v1` path.

## Model

Groups use Signal's sender keys. Each member has one sender key per group epoch. Its distribution message goes to every other member inside their 1:1 Signal session. A group message is then encrypted once with the sender key and stored once.

- `createSenderKeyDistribution(groupId)` creates the device's sender key if needed and returns an envelope. The envelope carries the group id and the distribution message, so the receiver learns the group from the encrypted payload, not from the server.
- `processSenderKeyDistribution(sender, plaintext)` stores a received key and records that this sender announced a key for this group.
- `groupEncrypt(groupId, plaintext)` / `groupDecrypt(sender, groupId, bytes)`. A message is accepted only under a key the sender announced for that same group. A key from one group cannot open another.
- `rotateSenderKey(groupId)` discards the device's own sender key for the group. The next `createSenderKeyDistribution` starts a new chain.

Client convention: `groupId = "<conversationId>:<epoch>"`. Each epoch is then a separate group to the bridge, so a key from an old epoch cannot be used for a new one.

## Epochs and membership

Every group conversation has `e2ee_epoch` (starts at 0). Any change to membership bumps it:

- join (approval, invitation, group chat join) and leave or removal, in `GroupController`, `GroupMemberController`, `GroupInvitationController` and `GroupChatController`;
- `E2eeGroupService::bumpEpoch` also deletes all sender key envelopes of the old epoch.

Adding a member also bumps the epoch. This is simpler than a separate rule for additions, at the cost of one full redistribution.

## Key rotation rules

1. After any epoch change, each member calls `rotateSenderKey`, creates a new distribution and sends one envelope to every other member.
2. A sender whose group message is refused with `409 STALE_KEY_EPOCH` repeats step 1 for the current epoch. The response carries `errors.epoch`.
3. A sender uploads envelopes only for the current epoch. The server refuses an upload for a stale epoch, and an upload must cover every other member exactly once.
4. A member who resets or loses their device creates a new device and must be redistributed to, through the normal epoch flow. Recovery from a lost device is out of scope here.

There is no time-based rotation. Rotation happens when membership changes.

## API

- `GET /api/v1/conversations/{id}/sender-keys`: current epoch and my unacknowledged envelopes for it.
- `POST /api/v1/conversations/{id}/sender-keys`: `{epoch, envelopes: [{recipient_user_id, ciphertext}]}`. Stores one envelope per other member. Upserts on (conversation, sender, recipient, epoch).
- `POST /api/v1/conversations/{id}/sender-keys/ack`: `{ids}`. Deletes my delivered envelopes.
- `POST /api/v1/conversations/{id}/messages` with `encryption: "signal_group_v1"`, `ciphertext`, `key_epoch`. Stored as one row. `signal_v1` is refused in a group, and `signal_group_v1` is refused in a direct chat. Refused for a stale epoch with 409.
- Encrypted rows cannot be edited or forwarded, since either would create plaintext or an empty copy.

## What the server can see

Visible to the server:

- group membership and join or leave times;
- the epoch number and when it changed;
- who sent each group message, when, its size and its `key_epoch`;
- for each envelope, the sender and recipient user ids, the epoch and the ciphertext size;
- read and typing metadata, as before.

Not visible to the server:

- message text, sender keys, chain keys, or any private key;
- the content of a distribution message or of a group message.

Envelopes are removed on acknowledgement, and all of an epoch's envelopes are removed when the epoch changes.

## Limits and known gaps

- Groups are capped at 256 members (`E2eeGroupService::MAX_MEMBERS`). Distribution is one envelope per member pair per epoch.
- Community and saved chats are not encrypted. Their membership changes do not bump an epoch, so they are excluded until they have a membership hook.
- One device per user. The bridge uses device id 1.
- A removed member keeps what they already decrypted, and anything sent under an epoch whose keys they held. They cannot read later epochs, because they receive no envelope for them.
- A new member cannot read messages from before they joined, because they receive no key for earlier epochs.
- One-time prekeys: `publicBundle()` advertises the lowest prekey not yet used up. The server must hand out a distinct bundle per session (the prekey table is consumed on claim).
