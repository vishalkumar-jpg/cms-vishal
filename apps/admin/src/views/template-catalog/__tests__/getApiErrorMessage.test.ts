import { describe, expect, it } from "bun:test";
import { getApiErrorMessage } from "../lib/getApiErrorMessage";

describe("getApiErrorMessage", () => {
  it("returns Nest string messages from Axios errors", () => {
    const err = {
      isAxiosError: true,
      response: { data: { message: "A page with slug landing already exists" }, status: 409 },
    };
    expect(getApiErrorMessage(err, "fallback")).toBe(
      "A page with slug landing already exists",
    );
  });

  it("joins Nest validation message arrays", () => {
    const err = {
      isAxiosError: true,
      response: {
        data: { message: ["title must be a string", "slug must be lowercase"] },
        status: 400,
      },
    };
    expect(getApiErrorMessage(err, "fallback")).toBe(
      "title must be a string; slug must be lowercase",
    );
  });

  it("falls back when the response has no message", () => {
    const err = { isAxiosError: true, response: { data: {}, status: 500 } };
    expect(getApiErrorMessage(err, "Could not create page")).toBe(
      "Could not create page",
    );
  });

  it("falls back when message arrays have no usable strings", () => {
    const err = {
      isAxiosError: true,
      response: { data: { message: ["", {}, "   "] }, status: 400 },
    };
    expect(getApiErrorMessage(err, "fallback")).toBe("fallback");
  });

  it("joins trimmed non-empty strings from mixed arrays", () => {
    const err = {
      isAxiosError: true,
      response: {
        data: { message: ["  title required  ", "", {}, "slug taken"] },
        status: 400,
      },
    };
    expect(getApiErrorMessage(err, "fallback")).toBe("title required; slug taken");
  });
});
