import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockReason } from '@bakimos/api-contracts';
import { Type } from 'class-transformer';
import {
  IsEnum,
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

export class CreatePartDto {
  @ApiProperty({ example: 'BRG-6205' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ default: 'adet' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  unit?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minQuantity?: number;
}

export class ListPartsQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  belowMin?: boolean;
}

export class CreateStockMovementDto {
  @ApiProperty()
  @IsUUID()
  partId!: string;

  @ApiProperty({ enum: [StockReason.RECEIPT, StockReason.ISSUE, StockReason.ADJUSTMENT] })
  @IsEnum(StockReason)
  reason!: typeof StockReason.RECEIPT | typeof StockReason.ISSUE | typeof StockReason.ADJUSTMENT;

  @ApiProperty({ description: 'Pozitif miktar. ISSUE için düşülür.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  operationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class IssueWorkOrderPartDto {
  @ApiProperty()
  @IsUUID()
  partId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  operationId?: string;
}

export class ListMovementsQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partId?: string;
}
