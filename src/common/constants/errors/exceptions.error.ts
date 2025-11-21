/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

// Not used at the moment
export type ErrorDetails = {
  code: string;
  message: string;
};

export class BadRequest extends BadRequestException {
  constructor(error?: any) {
    super({
      statusCode: 400,
      error: 'E_BAD_REQUEST',
      message: 'Bad request',
      data: error,
      errClass: 'custom-exception',
    });
  }
}

export class Conflict extends ConflictException {
  constructor(error?: any) {
    super({
      statusCode: 409,
      error: 'E_CONFLICT',
      message: 'Conflict',
      data: error,
      errClass: 'custom-exception',
    });
  }
}

export class Unauthorized extends UnauthorizedException {
  constructor(error?: any) {
    super({
      statusCode: 401,
      error: 'E_UNAUTHORIZED',
      message: 'Missing or invalid authentication token',
      data: error,
      description: 'custom-exception',
    });
  }
}

export class Forbidden extends ForbiddenException {
  constructor(error?: any) {
    super({
      statusCode: 403,
      error: 'E_FORBIDDEN',
      message: 'You are not able to access this resource',
      data: error,
      errClass: 'custom-exception',
    });
  }
}

export class NotFound extends NotFoundException {
  constructor(error?: any) {
    super({
      statusCode: 404,
      error: 'E_NOT_FOUND',
      message: 'The requested resource was not found',
      data: error,
      errClass: 'custom-exception',
    });
  }
}
