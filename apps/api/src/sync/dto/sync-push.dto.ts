import { ApiProperty } from '@nestjs/swagger';
import { FaultPriority, SyncOperationType } from '@bakimos/api-contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SyncFaultCreatePayloadDto {
  @ApiProperty()
  @IsUUID()
  equipmentId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ enum: FaultPriority })
  @IsEnum(FaultPriority)
  priority!: FaultPriority;
}

export class SyncPushOperationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  operationId!: string;

  @ApiProperty({ enum: SyncOperationType })
  @IsEnum(SyncOperationType)
  type!: typeof SyncOperationType.FAULT_CREATE;

  @ApiProperty({ description: 'Cihaz zamanı (ISO-8601). Yetki otoritesi değildir.' })
  @IsISO8601()
  clientCreatedAt!: string;

  @ApiProperty({ type: SyncFaultCreatePayloadDto })
  @ValidateNested()
  @Type(() => SyncFaultCreatePayloadDto)
  payload!: SyncFaultCreatePayloadDto;
}

export class SyncPushDto {
  @ApiProperty({ minLength: 8, maxLength: 64 })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  deviceId!: string;

  @ApiProperty({ type: [SyncPushOperationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SyncPushOperationDto)
  operations!: SyncPushOperationDto[];
}
