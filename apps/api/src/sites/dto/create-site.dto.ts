import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength, Validate } from 'class-validator';
import { TimeZoneConstraint } from '../../common/timezone';

export class CreateSiteDto {
  @ApiProperty({ example: 'Pres Hattı' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Europe/Istanbul' })
  @IsString()
  @Validate(TimeZoneConstraint)
  timezone!: string;
}
