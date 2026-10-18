import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(status: HttpStatus, code: string, message: string) {
    const errorName = HttpStatus[status] ?? 'ERROR';
    super({ statusCode: status, error: errorName, code, message }, status);
  }
}
