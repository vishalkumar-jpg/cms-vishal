import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class TopTemplateUsageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
