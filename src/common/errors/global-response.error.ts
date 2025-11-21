/* eslint-disable @typescript-eslint/no-unsafe-assignment */
export const GlobalResponseError: (
  statusCode: number,
  error: string,
  message: string,
  code: string,
  errClass?: string,
  data?: any,
) => IResponseError = (
  statusCode: 400 | 401 | 403 | 404 | 409 | 500,
  error: string,
  message: string,
  code: string,
  errClass?: string,
  data?: string,
): IResponseError => {
  const responseMap = {
    400: { code: 'E_BAD_REQUEST', message: 'Bad request' },
    401: {
      code: 'E_UNAUTHORIZED',
      message: 'Missing or invalid authentication token',
    },
    403: {
      code: 'E_FORBIDDEN',
      message: 'You are not able to access this resource',
    },
    404: {
      code: 'E_NOT_FOUND',
      message: 'The requested resource was not found',
    },
    409: { code: 'E_CONFLICT', message: 'Conflict' },
    500: {
      code: 'E_INTERNAL_SERVER_ERROR',
      message: 'An internal error has occurred',
    },
  };

  return {
    message: message || responseMap[statusCode].message,
    code: responseMap[statusCode].code || code,
    data: data,
  };
};

export interface IResponseError {
  // statusCode: number;
  // error: string;
  message: string;
  code: string;
  data?: any;
  // timestamp: string;
  // path: string;
  // method: string;
}
