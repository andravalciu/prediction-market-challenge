export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate registration input
 */
export function validateRegistration(
  username: string,
  email: string,
  password: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!username || username.length < 3) {
    errors.push({
      field: "username",
      message: "Username must be at least 3 characters",
    });
  }

  if (!email || !isValidEmail(email)) {
    errors.push({
      field: "email",
      message: "Invalid email address",
    });
  }

  if (!password || password.length < 6) {
    errors.push({
      field: "password",
      message: "Password must be at least 6 characters",
    });
  }

  return errors;
}

/**
 * Validate login input
 */
export function validateLogin(email: string, password: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!email || !isValidEmail(email)) {
    errors.push({
      field: "email",
      message: "Invalid email address",
    });
  }

  if (!password) {
    errors.push({
      field: "password",
      message: "Password is required",
    });
  }

  return errors;
}

/**
 * Validate market creation
 */
export function validateMarketCreation(
  title: string,
  description: string,
  outcomes: string[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!title || title.length < 5) {
    errors.push({
      field: "title",
      message: "Market title must be at least 5 characters",
    });
  }

  if (outcomes.length < 2) {
    errors.push({
      field: "outcomes",
      message: "Market must have at least 2 outcomes",
    });
  }

  if (outcomes.some((o) => !o || o.length === 0)) {
    errors.push({
      field: "outcomes",
      message: "All outcomes must have a title",
    });
  }

  return errors;
}

/**
 * Validate bet placement
 */
export function validateBet(amount: number | string): ValidationError[] {
  const errors: ValidationError[] = [];
  const numAmount = Number(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    errors.push({
      field: "amount",
      message: "Bet amount must be a positive number",
    });
  }

  return errors;
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
