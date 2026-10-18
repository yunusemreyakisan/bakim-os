import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipRole } from '@bakimos/api-contracts';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateMembershipDto {
  @ApiProperty({ example: 'teknisyen@fabrika.example' })
  @IsEmail({}, { message: 'Geçerli bir e-posta girin.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Mehmet Kaya' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: MembershipRole })
  @IsEnum(MembershipRole, { message: 'Geçersiz rol.' })
  role!: MembershipRole;

  @ApiPropertyOptional({
    description: 'Kullanıcı yoksa zorunludur. Var olan kullanıcının parolasını değiştirmez.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Parola en az 10 karakter olmalıdır.' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Parola en az bir harf ve bir rakam içermelidir.',
  })
  password?: string;
}
