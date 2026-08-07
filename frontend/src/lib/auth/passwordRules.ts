export const PASSWORD_RULES = [
  { label: 'At least 8 characters', check: (pwd: string) => pwd.length >= 8 },
  { label: 'One uppercase letter', check: (pwd: string) => /[A-Z]/.test(pwd) },
  { label: 'One lowercase letter', check: (pwd: string) => /[a-z]/.test(pwd) },
  { label: 'One number', check: (pwd: string) => /[0-9]/.test(pwd) },
];

export const validatePassword = (pwd: string) => {
  return PASSWORD_RULES.every(rule => rule.check(pwd));
};
