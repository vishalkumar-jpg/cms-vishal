import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString } from "class-validator";
import { ROLES } from "@ob-cms/shared";

export class AddMemberDto {
  @ApiProperty({ description: "Existing user id (usr_...)" })
  @IsString()
  userId!: string;

  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES as unknown as string[])
  role!: string;
}

export class UpdateRoleDto {
  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES as unknown as string[])
  role!: string;
}
