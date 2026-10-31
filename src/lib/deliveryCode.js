// The rider-facing message for a refused delivery code (POST /partner/orders/:id/deliver). Shared
// by the prepaid handover (DeliveryHandover.jsx) and cash collection (CodCollection.jsx).
export function deliveryCodeError(err) {
  switch (err?.code) {
    case "INVALID_OTP":
      // The server's message carries how many tries are left.
      return err.message || "Incorrect delivery code — ask the customer to check their app.";
    case "DELIVERY_OTP_REQUIRED":
      return "Ask the customer for their 4-digit delivery code.";
    case "DELIVERY_OTP_LOCKED":
      return "Too many wrong codes. Contact support — they can close this delivery.";
    default:
      return err?.message || "Couldn't confirm the delivery. Try again.";
  }
}
