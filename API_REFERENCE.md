# LeeTec Engine API Reference

LeeTec Engine supports **central inbound collections only**. The supported payment capabilities are:

- **C2B** direct payments to the registered child Till.
- **STK Push (Lipa Na M-Pesa Online)** using the Head Office shortcode for API authentication and the child Till as `PartyB`.

LeeTec does **not** call B2C, B2B, or direct disbursement APIs. Portal payout requests are recorded as manual ledger records for administrator processing.

## Base URL and API key

```text
https://leetec.online
```

Create a LeeTec API key in **Workspace → API keys**. The secret is shown once. Store it only on your backend, for example as `LEETEC_API_KEY`.

Use either supported authentication header:

```http
Authorization: Bearer sk_live_your_secret_key
```

or:

```http
x-api-key: sk_live_your_secret_key
```

A missing key returns `401`. An invalid, revoked, or suspended key returns `403`.

## Copyable environment configuration

Use these variables on your backend server. Replace the API-key placeholder with the secret copied once from **Workspace → API keys**.

```env
LEETEC_BASE_URL=https://leetec.online
LEETEC_API_KEY=sk_live_your_secret_key
```

Copyable test request:

```bash
curl -i -X POST "$LEETEC_BASE_URL/api/v1/stkpush" \
  -H "Authorization: Bearer $LEETEC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"254712345678","amount":10,"accountReference":"1TEST001","transactionDesc":"LeeTec API test","tillId":123}'
```

A successful test returns a `CheckoutRequestID`, `status: "PENDING"`, and `requestRecorded: true`. Confirm the final result through `GET $LEETEC_BASE_URL/api/v1/transactions` (or the equivalent `/api/v1/stkpush/history` and `/api/v1/collections` aliases) or a signed webhook; do not treat request acceptance as completed payment.

## STK Push — Lipa Na M-Pesa Online

```http
POST https://leetec.online/api/v1/stkpush
Content-Type: application/json
Authorization: Bearer sk_live_your_secret_key
```

Request:

```json
{
  "phoneNumber": "254712345678",
  "amount": 10,
  "accountReference": "1ORDER001",
  "transactionDesc": "Customer payment",
  "tillId": 123
}
```

The LeeTec server authenticates the Daraja request with the **Head Office shortcode**. A selected active child Till is sent as `PartyB`. The request always uses:

```json
{
  "TransactionType": "CustomerBuyGoodsOnline"
}
```

`phoneNumber` must be a valid Kenyan number and `amount` must be positive. `accountReference` is optional; if omitted, LeeTec generates an account-based reference. When supplied, it must start with `1` and be at most 64 characters. `transactionDesc` is optional. `tillId` must belong to an active Till owned by the account.

A successful HTTP response means Daraja accepted the STK request. It does **not** mean the customer has paid. Save the returned `CheckoutRequestID`, then wait for the callback and confirm the final `SUCCESS` or `FAILED` record in transaction history.

Example response:

```json
{
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing",
  "MerchantRequestID": "29115-...",
  "CheckoutRequestID": "ws_CO_...",
  "accountReference": "1ORDER001",
  "till": {
    "id": 123,
    "number": "123456",
    "name": "Main Till"
  },
  "estimatedPlatformFee": 1,
  "estimatedNetAmount": 9
}
```

## C2B direct Till payments

Customers can pay the registered child Till directly from the M-PESA menu. The Daraja C2B confirmation callback sends the transaction to LeeTec, which validates the Till, stores the transaction, updates the live dashboard, and dispatches signed webhooks.

C2B callback routes managed by LeeTec:

```text
POST https://leetec.online/api/v1/callbacks/c2b/validation
POST https://leetec.online/api/v1/callbacks/c2b/confirmation
```

The C2B confirmation record includes the M-PESA transaction ID, amount, customer phone number, Till number, account reference, receipt, and `SUCCESS` status. Duplicate confirmations are ignored safely.

## Complete transaction history

```http
GET https://leetec.online/api/v1/transactions
Authorization: Bearer sk_live_your_secret_key
```

This endpoint returns the complete current history for the authenticated account, including C2B/STK collections, manual ledger payout requests, and wallet deposits. The equivalent `/api/v1/stkpush/history` and `/api/v1/collections` paths return the same authenticated dataset. Results are newest first, preserve pending and failed records, and use `Cache-Control: no-store`.

```json
{
  "data": [
    {
      "kind": "COLLECTION",
      "id": 123,
      "checkoutRequestId": "C2B_MPESA123",
      "accountReference": "1ORDER001",
      "phoneNumber": "254712345678",
      "amount": "10.00",
      "status": "SUCCESS",
      "mpesaReceipt": "ABC123",
      "failureReason": null,
      "createdAt": "2026-09-13T07:00:00.000Z"
    },
    {
      "kind": "PAYOUT",
      "id": 12,
      "recipientPhone": "254712345678",
      "amount": "10.00",
      "status": "MANUAL_REVIEW",
      "commandId": "BusinessPayment",
      "createdAt": "2026-09-13T07:01:00.000Z"
    }
  ],
  "count": 2,
  "meta": {
    "resource": "transactions",
    "complete": true,
    "includes": ["collections", "payouts", "wallet_deposits"]
  }
}
```

Possible collection statuses are `PENDING`, `SUCCESS`, and `FAILED`. Manual payout records use `MANUAL_REVIEW` until an administrator processes them outside the portal. Fulfill customer orders only after a collection is `SUCCESS` and the receipt has been validated.

## Manual portal payout ledger

There is no public payout API and LeeTec never calls B2C or B2B disbursement endpoints. A portal administrator may record a payout request against the wallet ledger for manual review. Creating that record does not transfer money and does not call a Daraja disbursement endpoint.

## Signed webhooks

Configure an HTTPS endpoint in **Workspace → Webhooks**. LeeTec sends signed JSON `POST` events after a collection or wallet status is persisted.

```http
Content-Type: application/json
User-Agent: LeeTec-Webhook/1.0
X-LeeTec-Event: payment.success
X-LeeTec-Delivery: <unique-delivery-id>
X-LeeTec-Signature: sha256=<hex-hmac>
```

The signature is HMAC-SHA256 of the exact raw request body using the webhook secret. Verify it before parsing the payload. Deduplicate using `X-LeeTec-Delivery` or the payload `id`. Return any HTTP `2xx` response quickly, then process asynchronously. LeeTec retries failed deliveries up to three times and records the final delivery status.

Supported collection events:

| Event | Meaning |
|---|---|
| `payment.success` | STK or C2B collection confirmed and stored |
| `payment.failed` | STK collection failed or callback validation failed |
| `wallet.deposit.success` | Supported only where the configured inbound STK wallet flow is enabled |
| `wallet.deposit.failed` | Supported only where the configured inbound STK wallet flow is enabled |

Example:

```json
{
  "id": "delivery-id",
  "event": "payment.success",
  "createdAt": "2026-09-13T07:00:00.000Z",
  "data": {
    "transactionId": 123,
    "checkoutRequestId": "C2B_MPESA123",
    "accountReference": "1ORDER001",
    "phoneNumber": "254712345678",
    "amount": 10,
    "status": "SUCCESS",
    "failureReason": null,
    "mpesaReceipt": "ABC123"
  }
}
```

## Error handling

| HTTP status | Meaning |
|---|---|
| `400` | Invalid request data or Daraja rejected the operation |
| `401` | Missing API key or invalid STK callback token |
| `403` | Invalid, revoked, or suspended API key |
| `412` | Capability or configuration requirement is not satisfied |
| `500` | Unexpected server or database failure |

## Production checklist

1. Use `https://leetec.online` as the base URL.
2. Store the LeeTec API key only on your backend.
3. Configure the HO shortcode as the Daraja authentication shortcode.
4. Configure the child Till as the collection target (`PartyB`) for STK Push.
5. Confirm that STK requests use `CustomerBuyGoodsOnline`.
6. Register the C2B validation and confirmation URLs for the relevant Till.
7. Verify webhook HMAC signatures against the raw request body.
8. Deduplicate webhook deliveries.
9. Use transaction history or webhooks to wait for final payment status.
10. Keep disbursement processing manual; no B2C/B2B endpoint is used.
