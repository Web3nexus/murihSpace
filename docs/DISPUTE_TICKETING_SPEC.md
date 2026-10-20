# Internal Dispute & Pre-Chargeback Ticketing: Implementation Spec

Status: draft for review. Nothing here is built yet.

## Scope and principles

- The payment provider (Stripe, PayPal, Paystack, Flutterwave) holds the money. MurihSpace controls the ledger, the holds and the risk decisions. Holds are internal ledger holds, not gateway freezes.
- Every dispute is a ticket. Customer disputes (in-app) and pre-dispute network alerts (Ethoca, Verifi, provider webhooks) land in the same pipeline.
- Money moves only through the ledger, inside database transactions, with idempotency keys. No code path writes a balance directly.
- Holds are per transaction. A whole-wallet freeze is used only for a red flag or repeated fraud signals.

## 1. Data model

### `dispute_tickets`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `ticket_ref` | string unique | Public reference, e.g. `DSP-2026-000123` |
| `source` | enum | `customer`, `network_alert`, `admin` |
| `network_alert_ref` | string null, unique | Provider or network alert id; unique to dedupe repeated webhooks |
| `escrow_id` | FK null | Escrow, when the dispute is about an escrow |
| `order_id` | FK null | Order or fulfilment order |
| `brand_deal_milestone_id` | FK null | Brand-deal milestone, when relevant |
| `ledger_transaction_id` | FK | The original charge or credit being disputed |
| `buyer_id` | FK users | |
| `seller_id` | FK users | |
| `amount` | bigint | Minor units, the disputed amount |
| `currency` | char(3) | |
| `category` | enum | `not_received`, `not_as_described`, `unauthorised`, `duplicate`, `service_incomplete`, `other` |
| `status` | enum | `open`, `under_review`, `awaiting_merchant`, `resolved_refunded`, `resolved_won`, `resolved_closed` |
| `hold_id` | FK null | The ledger hold placed while the ticket is under review |
| `evidence_packet_id` | FK null | Current evidence bundle |
| `deadline_at` | timestamp null | Merchant response deadline (7 to 21 days from the provider) |
| `opened_at`, `resolved_at` | timestamp | |
| `resolved_by` | FK users null | Admin who closed it |
| `resolution_note` | text null | |
| timestamps | | |

Indexes: `status`, `seller_id`, `buyer_id`, `deadline_at`, unique `network_alert_ref`.

### `dispute_ticket_events` (append-only audit trail)

`id`, `dispute_ticket_id`, `actor_type` (`system`, `user`, `admin`, `provider`), `actor_id`, `from_status`, `to_status`, `payload` (json), `created_at`. Rows are never updated or deleted.

### Relationships

- A ticket belongs to exactly one ledger transaction, which links it to the financial record.
- The ticket's hold is a `wallet_holds` row (existing table) with `reference_type = dispute_ticket` and `reference_id = ticket id`.
- Buyer and seller are users. Their KYC state and wallet are read through those relations, never copied onto the ticket.

## 2. Evidence packet

Built automatically when a ticket is created and rebuilt when the merchant responds. It is an immutable snapshot, stored as JSON plus the PDF rendered from it.

Required data:

- **Identity:** KYC status and verification logs (provider, reference, verified_at) for buyer and seller.
- **Access:** IP address, user agent and device fingerprint for the payment and for each login in the 30 days before it, plus the current device list.
- **Conversation:** platform chat history between buyer and seller for the escrow or order, with message ids and timestamps.
- **Delivery:** tracking events, milestone submissions and approvals, download or access logs for digital goods.
- **Terms:** the signed Terms of Service version and the timestamp accepted by each party.
- **Money:** the ledger entries for the transaction, the escrow state history, fees and refunds already issued.

Rules:

- Collection is read-only and runs in a queued job. A failure to collect one section records the failure in the packet and does not block the ticket.
- Each section records its source query, the time it ran and a hash, so the packet can be verified later.
- Submission to the provider is done only from a packet that has been built for that deadline.

## 3. Financial state machine

### Hold order

When a ticket moves to `under_review`, the amount is secured in this order:

1. Active escrow funds for the transaction, if the escrow is still held.
2. The seller's available balance, up to the disputed amount.
3. The seller's rolling reserve, if the amount is still not covered.
4. If the amount is still uncovered, the ticket is flagged for the admin to decide, and the seller's negative balance is recorded.

A hold always uses the disputed amount, not the whole wallet. A whole-wallet freeze is applied only by an admin, for a red flag or several fraud disputes, and is recorded with a reason.

### Resolution

- **Refunded:** the buyer is credited from the held funds. The seller's held amount is reduced by the same figure. The provider is told about the refund through the existing refund service. No money leaves the platform account except through the provider.
- **Won or closed:** the hold is released back to the seller's available balance. The escrow release, if still pending, runs as normal.
- **Partly refunded:** the same as refunded, for the split amount. The remainder is released.

Every step is a ledger transaction with an idempotency key of the form `dispute:{ticket_id}:{step}:{attempt}`.

### Negative balances

If a refund or chargeback reduces a seller's balance below zero:

- The negative amount is recorded as a debt on the seller's wallet.
- Future credits (escrow releases, payouts reversed back to the wallet, earnings) repay the debt automatically before any amount becomes available.
- Withdrawals are blocked while a debt exists.
- The seller's account is shown the debt, with the tickets it came from.

## 4. Workflow

### Entry A: customer dispute (in-app)

1. Buyer taps "Open dispute" on an order, escrow or milestone. The form requires a category and a description, and allows attachments.
2. A ticket is created with `source = customer` and status `open`. The evidence packet build is queued.
3. The ticket moves to `under_review` once the hold is placed.

### Entry B: network pre-dispute alert

1. The provider or network webhook arrives. The signature is verified, and the payload is stored as-is.
2. The alert is matched to a ledger transaction. An unmatched alert is queued for admin matching and is not dropped.
3. A ticket is created with `source = network_alert` and the `network_alert_ref` set. A repeat alert with the same reference updates the existing ticket and is not duplicated.
4. The hold is placed immediately, before the merchant response deadline, so funds are secured even if no one has looked at the ticket yet.

### State transitions

```
open ──(hold placed)──────────────▶ under_review
under_review ──(seller responds)──▶ awaiting_merchant
under_review ──(admin decides)────▶ resolved_refunded | resolved_won | resolved_closed
awaiting_merchant ──(admin decides)▶ resolved_refunded | resolved_won | resolved_closed
awaiting_merchant ──(deadline passed, no response)──▶ resolved_refunded (recorded as lost)
resolved_* ──(reopen, admin only, within 30 days)──▶ under_review
```

Rules:

- Only admins with the `disputes` permission can move a ticket to a resolved state.
- Every transition writes a `dispute_ticket_events` row.
- A ticket past its `deadline_at` with no response is resolved according to the provider's rules, and this is logged.
- A seller can respond only through the ticket, with an optional attachment and an evidence update.
- A resolved ticket is never edited. Corrections are made by reopening it.

## Open questions for review

1. Who may place a hold manually, and is a second approval required above a threshold?
2. What is the red-flag rule for a whole-wallet freeze: how many fraud disputes, over what period?
3. Debt policy: is there a maximum debt, and should the seller be suspended past it?
4. Chargeback buffer: 5 to 10% rolling reserve for 30 to 60 days on high-risk accounts. Which accounts count as high-risk?
