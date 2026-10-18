import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkActivityKind, WorkOrderStatus } from '@bakimos/api-contracts';
import { Transform } from 'class-transformer';
import {
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
} from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.query';

export class CreateWorkOrderDto {
  @ApiProperty()
  @IsUUID()
  faultId!: string;

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
}

export class ListWorkOrdersQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: WorkOrderStatus })
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  faultId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class AssignWorkOrderDto {
  @ApiProperty()
  @IsUUID()
  assigneeId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;
}

export class VersionedWorkOrderDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;
}

export class TransitionWorkOrderDto {
  @ApiProperty({ enum: WorkOrderStatus })
  @IsEnum(WorkOrderStatus, { message: 'Geçersiz iş emri durumu.' })
  status!: WorkOrderStatus;

  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;
}

export class CreateWorkActivityDto {
  @ApiProperty({ enum: WorkActivityKind })
  @IsEnum(WorkActivityKind, { message: 'Geçersiz işlem türü.' })
  kind!: WorkActivityKind;

  @ApiProperty()
  @IsString()
  @MinLength(3, { message: 'İşlem açıklaması en az 3 karakter olmalıdır.' })
  @MaxLength(2000)
  description!: string;
}
