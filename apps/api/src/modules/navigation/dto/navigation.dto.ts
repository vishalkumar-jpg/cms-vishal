import { ApiProperty } from "@nestjs/swagger";
import { IsArray } from "class-validator";

export const NAV_LOCATIONS = ["header", "footer", "sidebar", "mobile"] as const;

export class UpsertNavigationDto {
  @ApiProperty({
    description: "Nested menu items: [{ label, href, pageId?, children[] }]",
    isArray: true,
    type: Object,
  })
  @IsArray()
  tree!: Array<Record<string, unknown>>;
}
