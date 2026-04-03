/**
 * @cossistant/transactional
 * Centralized email and transactional communication package
 *
 * This package provides:
 * - Email sending via SMTP (Brevo or any SMTP provider)
 * - Email templates using React Email
 * - No-op audience management (Resend-specific features disabled)
 */

// Constants (logos, avatars, etc.)
export * from "./constants";
// Email templates
export * from "./emails/index";
// SMTP utilities (client, types, constants, audience no-ops)
export * from "./smtp-utils/index";
// Main email sending functions
export { sendBatchEmail, sendEmail } from "./send-email";
