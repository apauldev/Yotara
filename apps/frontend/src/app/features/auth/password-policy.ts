export interface PasswordPolicyError {
  label: string;
  met: boolean;
}

export interface PasswordPolicyResult {
  valid: boolean;
  errors: PasswordPolicyError[];
}

const RULES: { key: string; label: string; test: (pw: string) => boolean }[] = [
  { key: 'minLength', label: '8+ characters', test: (pw) => pw.length >= 8 },
  { key: 'capital', label: 'Uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'lower', label: 'Lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { key: 'number', label: 'Number', test: (pw) => /[0-9]/.test(pw) },
  { key: 'symbol', label: 'Symbol', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

/** Check a password against all policy rules. Returns a result with per-rule status. */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  const errors = RULES.map((rule) => ({
    label: rule.label,
    met: rule.test(password),
  }));

  return {
    valid: errors.every((e) => e.met),
    errors,
  };
}

/** Convenience: returns a human-readable error message listing all unmet requirements. */
export function passwordPolicyMessage(password: string): string | null {
  const result = checkPasswordPolicy(password);
  if (result.valid) return null;

  const unmet = result.errors.filter((e) => !e.met).map((e) => e.label.toLowerCase());
  return `Password must include: ${unmet.join(', ')}.`;
}
