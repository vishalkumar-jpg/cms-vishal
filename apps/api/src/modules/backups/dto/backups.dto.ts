import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsBoolean } from "class-validator";

/**
 * Restore confirmation payload (E26). Restoring OVERWRITES the live database, so
 * the caller MUST send `confirm: true` — a missing/false flag is rejected 400 by
 * the controller before any job is enqueued.
 */
export class RestoreBackupDto {
  @ApiProperty({
    example: true,
    description:
      "Must be literally true. Restoring a backup OVERWRITES all current data — there is no undo.",
  })
  @IsBoolean()
  @Equals(true, { message: "confirm must be true to restore — restore overwrites all current data" })
  confirm!: boolean;
}
