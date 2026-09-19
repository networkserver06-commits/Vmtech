# LeeTec Engine API

LeeTec Engine provides a secure API for payment collection, transaction tracking, payment links, and optional webhooks.

## LeeTec connection

A LeeTec API integration needs only these two values:

```env
LEETEC_BASE_URL=https://leetec.online
LEETEC_API_KEY=your_leetec_api_key
```

Create the API key in **Workspace → API keys**. The key is shown once and must be stored on your backend. Do not place it in browser code, mobile code, public repositories, or client-side environment variables.

Use the key with every request:

```http
Authorization: Bearer your_leetec_api_key
```

The public base URL is:

```text
https://leetec.online
```

## Create a payment request

```http
POST https://leetec.online/api/v1/stkpush
Authorization: Bearer your_leetec_api_key
Content-Type: application/json
```

Example request:

```json
{
  "phoneNumber": "254700000000",
  "amount": 100,
  "accountReference": "1ORDER001",
  "transactionDesc": "Customer payment"
}
```

Request fields:

| Field | Required | Description |
|---|---:|---|
| `phoneNumber` | Yes | Kenyan mobile number in international or local format. |
| `amount` | Yes | Payment amount in Kenyan shillings. |
| `accountReference` | No | Your order or customer reference. |
| `transactionDesc` | No | Short description of the payment. |

A successful response means LeeTec accepted the request. It does not by itself confirm that the payment was completed. Save the returned request ID and check transaction history for the final status.

## Transaction history

```http
GET https://leetec.online/api/v1/transactions
Authorization: Bearer your_leetec_api_key
```

This returns the authenticated account's transaction history, newest first.

The following route is an equivalent collections-history alias:

```http
GET https://leetec.online/api/v1/collections
Authorization: Bearer your_leetec_api_key
```

Transaction statuses are:

| Status | Meaning |
|---|---|
| `PENDING` | The request was accepted and is awaiting confirmation. |
| `SUCCESS` | The payment was confirmed. |
| `FAILED` | The payment was not completed. |
| `CANCELLED` | The payment was cancelled. |

Only fulfill an order after the transaction is reported as `SUCCESS`.

## Payment links

LeeTec workspaces can create shareable payment links from **Workspace → Payment links**. A link can contain an optional amount and order reference.

Example format:

```text
https://leetec.online/pay/username
```

## Optional webhooks

Webhooks notify your server when a payment status changes. Configure them from **Workspace → Webhooks**. Webhooks are optional; transaction history remains the source of truth.

Your webhook endpoint should:

1. Use HTTPS.
2. Verify the LeeTec signature using the exact request body.
3. Return a successful HTTP response quickly.
4. Process duplicate deliveries safely.

## LeeTec Engine capabilities

LeeTec Engine provides:

- Secure payment collection through one public API.
- Complete payment status tracking.
- Transaction history for backend reconciliation.
- Shareable payment links.
- Optional signed webhook notifications.
- Workspace management for API keys, destinations, and integrations.
- Server-side handling of payment connectivity and operational configuration.

## Security checklist

- Keep `LEETEC_API_KEY` private.
- Use `https://leetec.online` as the base URL.
- Make API requests from your backend.
- Do not expose private keys or customer information in public documentation.
- Treat `SUCCESS` transaction history as the final payment confirmation.
- Rotate or revoke an API key if it may have been exposed.

## Common errors

| HTTP status | Meaning |
|---|---|
| `400` | The request data is invalid. |
| `401` | The LeeTec API key is missing or invalid. |
| `403` | The API key is revoked or unavailable. |
| `429` | Too many requests; retry after a short delay. |
| `500` | Temporary server or processing error. |
