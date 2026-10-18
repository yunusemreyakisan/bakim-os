import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceCadence, MaintenanceTaskStatus } from '@bakimos/api-contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.query';

export class MaintenancePlanItemInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateMaintenancePlanDto {
  @ApiProperty()
  @IsUUID()
  equipmentId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: MaintenanceCadence })
  @IsEnum(MaintenanceCadence)
  cadence!: MaintenanceCadence;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  interval?: number;

  @ApiProperty()
  @IsISO8601()
  nextDueAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiProperty({ type: [MaintenancePlanItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MaintenancePlanItemInputDto)
  items!: MaintenancePlanItemInputDto[];
}

export class UpdateMaintenancePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  nextDueAt?: string;
}

export class ListMaintenancePlansQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean;
}

export class ListMaintenanceTasksQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: MaintenanceTaskStatus })
  @IsOptional()
  @IsEnum(MaintenanceTaskStatus)
  status?: MaintenanceTaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'dueAt < now ve OPEN' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ description: 'Yaklaşan gün penceresi' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  upcomingDays?: number;
}

export class AssignMaintenanceTaskDto {
  @ApiProperty()
  @IsUUID()
  assigneeId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class CheckMaintenanceItemDto {
  @ApiProperty()
  @IsBoolean()
  checked!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CompleteMaintenanceTaskDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
