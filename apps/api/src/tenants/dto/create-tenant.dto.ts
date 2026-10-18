import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidateNested,
} from 'class-validator';
import { TimeZoneConstraint } from '../../common/timezone';

export class CreateTenantAdminDto {
  @ApiProperty({ example: 'admin@fabrika.example' })
  @IsEmail({}, { message: 'Geçerli bir e-posta girin.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Ayşe Yılmaz' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'Parola en az 10 karakter olmalıdır.' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Parola en az bir harf ve bir rakam içermelidir.',
  })
  password!: string;
}

export class CreateTenantSiteDto {
  @ApiProperty({ example: 'Ana Tesis' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Europe/Istanbul' })
  @IsOptional()
  @IsString()
  @Validate(TimeZoneConstraint)
  timezone?: string;
}

export class CreateTenantDto {
  @ApiProperty({ example: 'Demo Fabrika' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'demo-fabrika' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug yalnızca küçük harf, rakam ve tire içerebilir.',
  })
  @MaxLength(64)
  slug!: string;

  @ApiProperty({ type: CreateTenantAdminDto })
  @ValidateNested()
  @Type(() => CreateTenantAdminDto)
  admin!: CreateTenantAdminDto;

  @ApiPropertyOptional({ type: CreateTenantSiteDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateTenantSiteDto)
  site?: CreateTenantSiteDto;
}
