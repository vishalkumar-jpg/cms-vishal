import { HttpException, HttpStatus } from "@nestjs/common";
import { StatusCodes } from "http-status-codes";
import type { Response } from "express";

/**
 * Response envelope helpers — controllers ALWAYS return via these
 * (`{ data, status }`). Mirrors the boilerplate `responseUtils`. The admin
 * Axios mutator unwraps `.data`. Raw DB/driver errors are never leaked.
 */
export interface CommonResponseType<T> {
  data: T;
  status?: number;
}

interface ErrorResponseType {
  res: Response;
  error: Error | HttpException;
  errors?: string[];
  statusCode?: number;
}

const GENERIC_ERROR_MESSAGE = "Request could not be processed";

// Driver/ORM error class names that can leak schema/constraint fragments.
const LEAKY_ERROR_NAMES = new Set([
  "DatabaseError",
  "DrizzleError",
  "SyntaxError",
  "TypeError",
]);

class ResponseUtils {
  public success<T>(
    resp: Response,
    { data, status = StatusCodes.OK }: CommonResponseType<T>,
  ): Response<CommonResponseType<T>> {
    return resp.status(status).send({ data, status });
  }

  public error({ res, error, statusCode, errors }: ErrorResponseType): Response {
    const isHttp = error instanceof HttpException;
    const errorStatus = isHttp ? error.getStatus() : HttpStatus.BAD_REQUEST;
    const safeMessage =
      isHttp && !LEAKY_ERROR_NAMES.has(error.name) ? error.message : GENERIC_ERROR_MESSAGE;

    return res.status(statusCode ?? errorStatus).send({
      statusCode: statusCode ?? errorStatus,
      message: safeMessage,
      ...(errors && errors.length > 0 ? { errors } : {}),
    });
  }
}

export default new ResponseUtils();
