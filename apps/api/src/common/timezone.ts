import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

export function isValidTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

@ValidatorConstraint({ name: 'timeZone', async: false })
export class TimeZoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidTimeZone(value);
  }

  defaultMessage(): string {
    return 'Geçerli bir IANA saat dilimi girin.';
  }
}
