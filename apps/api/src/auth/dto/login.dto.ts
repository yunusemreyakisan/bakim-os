import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@demo.bakimos.local' })
  @IsEmail({}, { message: 'Geçerli bir e-posta girin.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'DevOnly-Change-Me-1' })
  @IsString()
  @MinLength(1, { message: 'Parola gerekli.' })
  @MaxLength(128)
  password!: string;
}
