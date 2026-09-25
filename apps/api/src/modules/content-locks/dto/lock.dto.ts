import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

/** POST {pages,posts}/:id/lock body — acquire or (with takeOver) steal the lock. */
export class AcquireLockDto {
  @ApiProperty({
    required: false,
    description: "Steal a live lock held by another editor (explicit take-over).",
  })
  @IsOptional()
  @IsBoolean()
  takeOver?: boolean;
}
