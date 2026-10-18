import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FaultPriority, FaultStatus } from '@bakimos/api-contracts';
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.query';

export class CreateFaultDto {
  @ApiProperty()
  @IsUUID()
  equipmentId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5, { message: 'Arıza açıklaması en az 5 karakter olmalıdır.' })
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ enum: FaultPriority })
  @IsEnum(FaultPriority, { message: 'Geçersiz öncelik.' })
  priority!: FaultPriority;
}

export class ListFaultsQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @ApiPropertyOptional({ enum: FaultStatus })
  @IsOptional()
  @IsEnum(FaultStatus)
  status?: FaultStatus;

  @ApiPropertyOptional({ enum: FaultPriority })
  @IsOptional()
  @IsEnum(FaultPriority)
  priority?: FaultPriority;

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
