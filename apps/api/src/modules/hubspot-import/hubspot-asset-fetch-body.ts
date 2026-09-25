export class HubspotAssetFetchBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HubspotAssetFetchBodyError";
  }
}

/** Read a fetch response body with Content-Length pre-check and streaming byte cap. */
export const readFetchResponseBodyLimited = async (
  res: Response,
  maxBytes: number,
): Promise<Buffer> => {
  const contentLengthHeader = res.headers.get("content-length");
  if (contentLengthHeader !== null && contentLengthHeader.trim().length > 0) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      throw new HubspotAssetFetchBodyError("Invalid Content-Length header.");
    }
    if (contentLength > maxBytes) {
      throw new HubspotAssetFetchBodyError("Asset exceeds migration size limit.");
    }
  }

  if (!res.body) {
    throw new HubspotAssetFetchBodyError("Response body is missing.");
  }

  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new HubspotAssetFetchBodyError("Asset exceeds migration size limit.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
};
