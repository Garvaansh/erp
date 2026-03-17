package configs

import (
	"log"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

func LoadConfig() {
	// Need to find the .env file in the project root
	cwd, _ := os.Getwd()
	envPath := filepath.Join(cwd, ".env")
	err := godotenv.Load(envPath)
	if err != nil {
		log.Println("No .env file found, using OS environments")
	}
}

func GetEnv(key string, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// WhatsApp (optional). If set, pkg/notifications can send messages via Meta Cloud API.
// WHATSAPP_PHONE_ID    - Business phone number ID from Meta App Dashboard
// WHATSAPP_ACCESS_TOKEN - Permanent or system user access token with whatsapp_business_messaging
// WHATSAPP_API_BASE_URL - Optional; default https://graph.facebook.com/v21.0
