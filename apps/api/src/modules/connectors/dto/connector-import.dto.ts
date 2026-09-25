import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { HUBSPOT_IMPORT_SCOPES, type HubspotImportScope } from "@ob-cms/block-schema";

export class ConnectorImportRunRequestDto {
  @ApiProperty({ enum: HUBSPOT_IMPORT_SCOPES, example: HUBSPOT_IMPORT_SCOPES[0] })
  @IsIn(HUBSPOT_IMPORT_SCOPES)
  scope!: HubspotImportScope;
}
