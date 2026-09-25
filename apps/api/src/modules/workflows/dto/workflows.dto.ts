import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import {
  WORKFLOW_ACTION_TYPES,
  WORKFLOW_STATUSES,
  WORKFLOW_TRIGGERS,
} from "@database/schema";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** The workflow trigger: a type + a free-form config object. */
export class WorkflowTriggerDto {
  @ApiProperty({ enum: WORKFLOW_TRIGGERS })
  @IsIn(WORKFLOW_TRIGGERS as unknown as string[])
  type!: string;

  @ApiProperty({ required: false, description: "Trigger config (audienceId | formId | threshold | path)" })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

/** One ordered action on create/update (actions replace the full set). */
export class WorkflowActionDto {
  @ApiProperty({ enum: WORKFLOW_ACTION_TYPES })
  @IsIn(WORKFLOW_ACTION_TYPES as unknown as string[])
  type!: string;

  @ApiProperty({ required: false, description: "Action config (url | email | audienceId | points | waitSeconds | tag | event)" })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

/** Create/update a workflow (trigger + ordered actions). */
export class WorkflowDto {
  @ApiProperty({ example: "Notify sales on hot lead" })
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ required: false, enum: WORKFLOW_STATUSES, default: "paused" })
  @IsOptional()
  @IsIn(WORKFLOW_STATUSES as unknown as string[])
  status?: string;

  @ApiProperty({ type: WorkflowTriggerDto })
  @ValidateNested()
  @Type(() => WorkflowTriggerDto)
  trigger!: WorkflowTriggerDto;

  @ApiProperty({ type: [WorkflowActionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowActionDto)
  actions!: WorkflowActionDto[];
}

/** Change a workflow's status (activate / pause). */
export class WorkflowStatusDto {
  @ApiProperty({ enum: WORKFLOW_STATUSES })
  @IsIn(WORKFLOW_STATUSES as unknown as string[])
  status!: string;
}

/** Dry-run a workflow against a sample subject. */
export class WorkflowTestDto {
  @ApiProperty({ required: false, description: "A sample visitorId to dry-run against" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  visitorId?: string;
}
