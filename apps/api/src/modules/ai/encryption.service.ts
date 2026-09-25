import { Injectable } from "@nestjs/common";
import { decryptSecret, encryptSecret, maskSecret } from "@ob-cms/crypto";
import { getOsEnv, getOsEnvOptional } from "@config/env.config";

/**
 * At-rest encryption for tenant BYOK keys (WAVE4a). A thin abstraction over the
 * shared AES-256-GCM envelope so an AWS KMS-backed implementation can replace it
 * later WITHOUT any caller changing (only this class swaps). The data key comes
 * from env (`ENCRYPTION_KEY`, falling back to `KMS_DATA_KEY`). Plaintext keys are
 * NEVER logged or returned — callers store/return only `mask()`.
 */
@Injectable()
export class EncryptionService {
  private readonly dataKey =
    getOsEnvOptional("ENCRYPTION_KEY") || getOsEnv("KMS_DATA_KEY");

  /** Encrypt a plaintext secret into the opaque `v1:iv:tag:ct` envelope. */
  encrypt(plaintext: string): string {
    return encryptSecret(plaintext, this.dataKey);
  }

  /** Decrypt an envelope back to plaintext (used only inside the provider call). */
  decrypt(envelope: string): string {
    return decryptSecret(envelope, this.dataKey);
  }

  /** Non-reversible masked hint for display (e.g. `sk-a…X9f2`). */
  mask(plaintext: string): string {
    return maskSecret(plaintext);
  }
}
