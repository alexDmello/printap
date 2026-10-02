/**
 * Printap — Validation Utilities
 * RFC 5321 / RFC 5322 compliant email validation
 */

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
  normalizedEmail: string;
}

/**
 * Validates an email address against standard RFC format rules:
 * - Max length: 254 chars (RFC 5321)
 * - Local part: 1-64 chars, no leading/trailing dots, no consecutive dots (..)
 * - Domain part: must have valid labels and an alphabetic TLD of >= 2 characters
 * - No whitespace allowed
 */
export function validateEmail(email: string | null | undefined): EmailValidationResult {
  if (!email || typeof email !== "string") {
    return { valid: false, reason: "Email address is required.", normalizedEmail: "" };
  }

  const trimmed = email.trim().toLowerCase();

  if (trimmed.length === 0) {
    return { valid: false, reason: "Email address cannot be empty.", normalizedEmail: "" };
  }

  if (trimmed.length > 254) {
    return { valid: false, reason: "Email address cannot exceed 254 characters.", normalizedEmail: trimmed };
  }

  if (/\s/.test(trimmed)) {
    return { valid: false, reason: "Email address cannot contain spaces.", normalizedEmail: trimmed };
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return { valid: false, reason: "Email address must contain exactly one '@' symbol.", normalizedEmail: trimmed };
  }

  const [localPart, domainPart] = parts;

  if (localPart.length === 0 || localPart.length > 64) {
    return {
      valid: false,
      reason: "The username before '@' must be 1 to 64 characters long.",
      normalizedEmail: trimmed,
    };
  }

  if (localPart.startsWith(".") || localPart.endsWith(".")) {
    return { valid: false, reason: "Email address cannot start or end with a dot.", normalizedEmail: trimmed };
  }

  if (localPart.includes("..")) {
    return { valid: false, reason: "Email address cannot contain consecutive dots (..).", normalizedEmail: trimmed };
  }

  if (!domainPart || !domainPart.includes(".")) {
    return {
      valid: false,
      reason: "Email domain must include a valid extension (e.g. .com, .in).",
      normalizedEmail: trimmed,
    };
  }

  if (domainPart.startsWith(".") || domainPart.endsWith(".") || domainPart.includes("..")) {
    return { valid: false, reason: "Email domain contains invalid dot placement.", normalizedEmail: trimmed };
  }

  // Comprehensive RFC 5322 regex:
  // Requires valid characters, non-consecutive dots, and alphabetic TLD of at least 2 characters
  const RFC_EMAIL_REGEX =
    /^[a-zA-Z0-9_%+-]+(?:\.[a-zA-Z0-9_%+-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

  if (!RFC_EMAIL_REGEX.test(trimmed)) {
    return {
      valid: false,
      reason: "Please enter a valid email format (e.g. owner@example.com).",
      normalizedEmail: trimmed,
    };
  }

  return { valid: true, normalizedEmail: trimmed };
}

/**
 * Returns true if an email string is strictly valid.
 */
export function isValidEmail(email: string | null | undefined): boolean {
  return validateEmail(email).valid;
}
