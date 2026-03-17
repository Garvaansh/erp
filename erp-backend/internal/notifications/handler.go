package notifications

import (
	"github.com/gofiber/fiber/v2"
	"github.com/reva-erp/backend/pkg/middleware"
	wa "github.com/reva-erp/backend/pkg/notifications"
)

var whatsAppClient *wa.WhatsAppClient

func init() {
	whatsAppClient = wa.NewWhatsAppClient()
}

// SendWhatsApp expects JSON: { "to": "+919876543210", "message": "Hello" }.
// "to" must be E.164 (digits only or with +). Requires JWT.
func SendWhatsApp(c *fiber.Ctx) error {
	if !whatsAppClient.IsEnabled() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "WhatsApp notifications are not configured. Set WHATSAPP_PHONE_ID and WHATSAPP_ACCESS_TOKEN.",
		})
	}
	var body struct {
		To      string `json:"to"`
		Message string `json:"message"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON"})
	}
	if body.To == "" || body.Message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "to and message are required"})
	}
	if err := whatsAppClient.SendText(body.To, body.Message); err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true, "message": "Message sent"})
}

// WhatsAppStatus returns whether WhatsApp is configured (for UI/admin).
func WhatsAppStatus(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"enabled": whatsAppClient.IsEnabled(),
	})
}

// SetupRoutes registers notification routes on the given router.
func SetupRoutes(router fiber.Router) {
	notif := router.Group("/notifications")
	notif.Use(middleware.JWTProtected())
	notif.Get("/whatsapp/status", WhatsAppStatus)
	notif.Post("/whatsapp/send", SendWhatsApp)
}
