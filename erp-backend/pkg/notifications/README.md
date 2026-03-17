# Notifications

WhatsApp notifications use the [WhatsApp Business Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) (Meta).

## Setup

1. Create a [Meta for Developers](https://developers.facebook.com/) app and add the WhatsApp product.
2. Get your **Phone number ID** from WhatsApp → API Setup (or Business phone numbers).
3. Generate a **permanent access token** (System User or App token) with `whatsapp_business_messaging` and `whatsapp_business_management`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WHATSAPP_PHONE_ID` | Yes* | Business phone number ID from the Meta App Dashboard. |
| `WHATSAPP_ACCESS_TOKEN` | Yes* | Access token with WhatsApp messaging permission. |
| `WHATSAPP_API_BASE_URL` | No | API base URL; default `https://graph.facebook.com/v21.0`. |

\* If both `WHATSAPP_PHONE_ID` and `WHATSAPP_ACCESS_TOKEN` are set, the app can send WhatsApp messages. If either is missing, the client is disabled and send calls no-op.

## API

- **GET /api/v1/notifications/whatsapp/status** (JWT) – Returns `{ "enabled": true }` or `{ "enabled": false }`.
- **POST /api/v1/notifications/whatsapp/send** (JWT) – Body: `{ "to": "+919876543210", "message": "Hello" }`. `to` must be E.164 (with or without `+`).

## Usage in code

```go
import "github.com/reva-erp/backend/pkg/notifications"

client := notifications.NewWhatsAppClient()
if client.IsEnabled() {
    _ = client.SendText("919876543210", "Your report is ready.")
}
```
