# LeeTec Engine API Reference

LeeTec Engine provides server-to-server payment operations, a complete transaction history endpoint, and signed webhook events. All requests must use HTTPS and must be made from a trusted backend. Never expose an API key in browser, mobile, or client-side JavaScript.

## Base URL

```text
https://leetec.online
```

## Authentication

Use either header:

```http
Authorization: Bearer sk_live_your_secret_key
```

or:

```http
x-api-key: sk_live_your_secret_key
```

A missing key returns `401`. An invalid, revoked, or suspended key returns `403`.

## Create an STK Push

```http
POST /api/v1/stkpush
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

`phoneNumber` must be a Kenyan number accepted by the LeeTec validation rules. `amount` must be positive. `accountReference` is optional; if omitted, LeeTec generates an account-based reference automatically. When supplied, it must start with `1` and be at most 64 characters. `transactionDesc` is optional. `tillId` is optional and must belong to an active destination owned by the authenticated account.

An accepted request returns the Daraja response, including `CheckoutRequestID`, plus the LeeTec `accountReference`, selected till details, and estimated platform fee. Acceptance means the request was sent to Safaricom; it does not mean the customer has paid. The final status is confirmed asynchronously through the callback and transaction history.

Example response:

```json
{
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing",
  "MerchantRequestID": "29115-...",
  "CheckoutRequestID": "ws_CO_...",
  "accountReference": "1ORDER001",
  "till": null,
  "estimatedPlatformFee": 1,
  "estimatedNetAmount": 9
}
```

## Complete transaction history

```http
GET /api/v1/transactions
Authorization: Bearer sk_live_your_secret_key
```

This endpoint returns the complete current history for the authenticated account, including collections, payouts, and wallet deposits. Results are sorted newest first and are returned with `Cache-Control: no-store` so clients do not reuse stale statuses.

Example response:

```json
{
  "data": [
    {
      "kind": "COLLECTION",
      "id": 123,
      "checkoutRequestId": "ws_CO_...",
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
      "status": "PENDING",
      "conversationId": "...",
      "createdAt": "2026-09-13T07:01:00.000Z"
    },
    {
      "kind": "WALLET_DEPOSIT",
      "id": 8,
      "checkoutRequestId": "ws_CO_...",
      "phoneNumber": "254712345678",
      "amount": "100.00",
      "status": "SUCCESS",
      "createdAt": "2026-09-13T07:02:00.000Z"
    }
  ],
  "count": 3,
  "meta": {
    "resource": "transactions",
    "complete": true,
    "includes": ["collections", "payouts", "wallet_deposits"]
  }
}
```

Possible statuses are `PENDING`, `SUCCESS`, and `FAILED`. Fulfill an order only after the record is `SUCCESS` and, for a collection, a validated M-PESA receipt is present.

## Payouts

```http
POST /api/v1/payout
Content-Type: application/json
Authorization: Bearer sk_live_your_secret_key
```

Request:

```json
{
  "phoneNumber": "254712345678",
  "amount": 10,
  "commandId": "BusinessPayment"
}
```

`commandId` may be `BusinessPayment` or `SalaryPayment`. A payout is initially `PENDING`; the B2C result callback changes it to `SUCCESS` or `FAILED` and the result appears in `/api/v1/transactions`.

## LeeTec webhook events

Configure an HTTPS endpoint in the LeeTec workspace. LeeTec sends a JSON `POST` when a persisted status changes. Webhook requests include:

```http
Content-Type: application/json
User-Agent: LeeTec-Webhook/1.0
X-LeeTec-Event: payment.success
X-LeeTec-Delivery: <unique-delivery-id>
X-LeeTec-Signature: sha256=<hex-hmac>
```

The signature is HMAC-SHA256 of the exact raw request body using the endpoint secret. Verify the signature before parsing or processing the payload. Use `X-LeeTec-Delivery` or the payload `id` for idempotency. Return any HTTP `2xx` response quickly, then process asynchronously. LeeTec retries failed delivery attempts up to three times with short backoff and records the final delivery status.

Supported events include:

| Event | Meaning |
|---|---|
| `payment.success` | STK collection confirmed and receipt validated |
| `payment.failed` | STK collection failed, cancelled, timed out, or failed validation |
| `wallet.deposit.success` | Wallet deposit confirmed and credited |
| `wallet.deposit.failed` | Wallet deposit failed |
| `payout.success` | B2C payout confirmed |
| `payout.failed` | B2C payout failed or timed out |

Example `payment.success` payload:

```json
{
  "id": "delivery-id",
  "event": "payment.success",
  "createdAt": "2026-09-13T07:00:00.000Z",
  "data": {
    "transactionId": 123,
    "checkoutRequestId": "ws_CO_...",
    "accountReference": "1ORDER001",
    "phoneNumber": "254712345678",
    "amount": 10,
    "status": "SUCCESS",
    "failureReason": null,
    "mpesaReceipt": "ABC123",
    "createdAt": "2026-09-13T07:00:00.000Z"
  }
}
```

## Safaricom callback routes

These routes are managed by LeeTec and are not customer webhook endpoints:

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/callbacks/stk` | Receives STK Push result callbacks |
| `POST` | `/api/v1/callbacks/c2b/confirmation` | Receives confirmed C2B transactions |
| `POST` | `/api/v1/callbacks/c2b/validation` | Accepts C2B validation requests |
| `POST` | `/api/v1/callbacks/b2c/result` | Receives B2C payout results |
| `POST` | `/api/v1/callbacks/b2c/timeout` | Receives B2C timeout results |

LeeTec acknowledges valid callbacks immediately and processes persistence and downstream webhook delivery asynchronously. This keeps Safaricom callback responses fast while preserving the final status in the database.

## Error handling

| HTTP status | Meaning |
|---|---|
| `400` | Invalid request data or Daraja rejected the operation |
| `401` | API key missing or callback token invalid |
| `403` | API key invalid, revoked, or account suspended |
| `500` | Unexpected server or database failure |

Always inspect the JSON `error` field and do not treat an HTTP `2xx` STK response as a completed payment.

## Production checklist

1. Store the API key in a backend secret manager or environment variable.
2. Use HTTPS for API calls and webhook endpoints.
3. Verify the raw-body HMAC signature before accepting webhook data.
4. Deduplicate webhook deliveries using `X-LeeTec-Delivery` or payload `id`.
5. Poll `/api/v1/transactions` or consume webhooks until the final status is visible.
6. Fulfill orders only after `SUCCESS`.
7. Monitor failed webhook deliveries and keep the endpoint responsive.
