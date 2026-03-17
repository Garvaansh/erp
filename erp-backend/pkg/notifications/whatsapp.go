package notifications

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/reva-erp/backend/configs"
)

const (
	whatsappGraphURL = "https://graph.facebook.com/v21.0"
)

// WhatsAppClient sends messages via the WhatsApp Business Cloud API (Meta).
type WhatsAppClient struct {
	baseURL    string
	phoneID    string
	accessToken string
	enabled    bool
	client     *http.Client
}

// NewWhatsAppClient builds a client from env: WHATSAPP_PHONE_ID, WHATSAPP_ACCESS_TOKEN.
// If either is empty, the client is disabled (SendText no-ops and returns nil).
func NewWhatsAppClient() *WhatsAppClient {
	phoneID := configs.GetEnv("WHATSAPP_PHONE_ID", "")
	token := configs.GetEnv("WHATSAPP_ACCESS_TOKEN", "")
	base := configs.GetEnv("WHATSAPP_API_BASE_URL", whatsappGraphURL)
	enabled := phoneID != "" && token != ""
	return &WhatsAppClient{
		baseURL:      strings.TrimSuffix(base, "/"),
		phoneID:      phoneID,
		accessToken:  token,
		enabled:      enabled,
		client:       &http.Client{},
	}
}

// IsEnabled returns true if WhatsApp is configured and can send messages.
func (w *WhatsAppClient) IsEnabled() bool {
	return w.enabled
}

// textRequest is the JSON body for a text message (WhatsApp Cloud API).
type textRequest struct {
	MessagingProduct string   `json:"messaging_product"`
	RecipientType   string   `json:"recipient_type"`
	To              string   `json:"to"`
	Type            string   `json:"type"`
	Text            textBody `json:"text"`
}

type textBody struct {
	Body       string `json:"body"`
	PreviewURL bool   `json:"preview_url,omitempty"`
}

// textResponse is the success response from the API.
type textResponse struct {
	Messages []struct {
		ID string `json:"id"`
	} `json:"messages"`
	Error *struct {
		Message      string `json:"message"`
		Type         string `json:"type"`
		Code         int    `json:"code"`
		ErrorSubcode int    `json:"error_subcode"`
		FBTraceID    string `json:"fbtrace_id"`
	} `json:"error"`
}

// SendText sends a text message to the given phone number.
// Phone should be in E.164 format (e.g. 919876543210 or +919876543210; + is stripped).
// Returns nil if WhatsApp is disabled or message was sent successfully.
func (w *WhatsAppClient) SendText(to string, body string) error {
	if !w.enabled {
		return nil
	}
	to = strings.TrimSpace(to)
	body = strings.TrimSpace(body)
	if to == "" || body == "" {
		return fmt.Errorf("notifications/whatsapp: to and body are required")
	}
	to = strings.TrimPrefix(to, "+")

	payload := textRequest{
		MessagingProduct: "whatsapp",
		RecipientType:    "individual",
		To:               to,
		Type:             "text",
		Text:             textBody{Body: body},
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("notifications/whatsapp: marshal request: %w", err)
	}

	url := w.baseURL + "/" + w.phoneID + "/messages"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("notifications/whatsapp: new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+w.accessToken)

	resp, err := w.client.Do(req)
	if err != nil {
		return fmt.Errorf("notifications/whatsapp: request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var parsed textResponse
	_ = json.Unmarshal(respBody, &parsed)

	if parsed.Error != nil {
		return fmt.Errorf("notifications/whatsapp: API error (code %d): %s", parsed.Error.Code, parsed.Error.Message)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("notifications/whatsapp: HTTP %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}
