import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EquipmentStatus } from '@bakimos/api-contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.query';

export class CreateEquipmentDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty({ example: 'CNC-01' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, {
    message: 'Ekipman kodu harf veya rakamla başlamalıdır.',
  })
  code!: string;

  @ApiProperty({ example: 'CNC Torna' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateEquipmentDto {
  @ApiProperty({ description: 'Optimistic concurrency sürümü.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, {
    message: 'Ekipman kodu harf veya rakamla başlamalıdır.',
  })
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: [EquipmentStatus.ACTIVE, EquipmentStatus.INACTIVE] })
  @IsOptional()
  @IsIn([EquipmentStatus.ACTIVE, EquipmentStatus.INACTIVE])
  status?: typeof EquipmentStatus.ACTIVE | typeof EquipmentStatus.INACTIVE;
}

export class ArchiveEquipmentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class QrPdfDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  equipmentIds!: string[];
}

export class ListEquipmentQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({ enum: EquipmentStatus })
  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;
}
