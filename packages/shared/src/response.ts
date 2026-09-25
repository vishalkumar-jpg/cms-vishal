import { z } from "zod";

/**
 * The API envelope. Every controller returns via `responseUtils.success/error`
 * producing `{ data, status }`. The admin Axios mutator unwraps `.data`.
 * Mirrors the boilerplate `CommonResponseType<T>`.
 */
export interface ResponseDto<T = unknown> {
  data: T;
  status: number;
}

export interface ApiErrorDto {
  statusCode: number;
  message: string;
  errors?: string[] | Array<{ row: number; errorMessages: string[] }>;
}

export const responseDtoSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ data, status: z.number() });
