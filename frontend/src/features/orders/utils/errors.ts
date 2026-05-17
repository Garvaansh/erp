import { ApiClientError } from "@/lib/api/api-client";

function includes(text: string, fragment: string): boolean {
  return text.toLowerCase().includes(fragment.toLowerCase());
}

export function getOrderErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiClientError) {
    const message = error.message || fallback;

    if (error.statusCode === 409) {
      if (includes(message, "insufficient finished goods inventory")) {
        return "Not enough finished inventory available for this reservation.";
      }

      if (
        includes(message, "valid state") ||
        includes(message, "already finalized")
      ) {
        return "This order was updated by another operation. Please refresh and try again.";
      }

      return message;
    }

    if (error.statusCode === 404) {
      return "The requested order record could not be found.";
    }

    if (error.statusCode === 400) {
      return message;
    }

    if (error.statusCode >= 500) {
      return fallback;
    }

    return message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function getCustomerErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.statusCode === 409) {
      return "Possible existing customers found. Please verify before creating a new customer.";
    }

    if (error.statusCode === 400) {
      return error.message || "Please review the customer details and try again.";
    }
  }

  return "Unable to create customer right now.";
}
