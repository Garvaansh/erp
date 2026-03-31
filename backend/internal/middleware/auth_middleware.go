package middleware

import (
	"fmt"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// RequireAuth is a Fiber middleware for JWT authentication.
// It protects routes by validating a JWT token from a cookie.
func RequireAuth(c *fiber.Ctx) error {
	// 1. Read the JWT token from the 'jwt_token' cookie.
	tokenString := c.Cookies("jwt_token")

	// 2. If the cookie is missing, return a 401 Unauthorized response.
	if tokenString == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": "Authorization required: Missing JWT token",
		})
	}

	// 3. Parse and validate the token.
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// CRITICAL: Validate the signing method is HMAC as expected.
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		// Return the secret key for validation.
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			// This should not happen in a configured environment.
			return nil, fmt.Errorf("JWT_SECRET is not set")
		}
		return []byte(secret), nil
	})

	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Invalid or expired token: %v", err),
		})
	}

	// 4. If the token is valid, extract the claims.
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		// 5. Extract userID and role.
		userID, userOk := claims["user_id"].(string) 
		role, roleOk := claims["role"].(string)

		if !userOk || !roleOk {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"status":  "error",
				"message": "Invalid token claims: missing userID or role",
			})
		}

		// 6. Store the userID and role in the Fiber context for downstream handlers.
		c.Locals("userID", userID) 
		c.Locals("role", role)

		// 7. Call c.Next() to pass control to the actual route handler.
		return c.Next()
	}

	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"status":  "error",
		"message": "Invalid token",
	})
}
