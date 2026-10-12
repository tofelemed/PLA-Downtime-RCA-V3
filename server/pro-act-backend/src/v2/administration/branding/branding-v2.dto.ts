import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
/** An https/http address or an inline image (`data:image/...;base64,`), as the logo field accepts. */
const IMAGE_SOURCE =
  /^(https?:\/\/\S+|data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+)$/;
/** Inline images stay under the 1 MiB request limit together (two images of at most 400 000 characters). */
export const IMAGE_MAX_LENGTH = 400_000;
export const LOGO_FITS = [
  'contain',
  'cover',
  'fill',
  'none',
  'scale-down',
] as const;

/** `PUT /v2/branding`: the application-wide name, logo and colours (super administrators). */
export class BrandingV2Dto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  appName: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  appSubtitle?: string;

  @ApiPropertyOptional({
    maxLength: IMAGE_MAX_LENGTH,
    description: 'Image address or inline image',
  })
  @IsOptional()
  @IsString()
  @MaxLength(IMAGE_MAX_LENGTH)
  @Matches(IMAGE_SOURCE)
  logoUrl?: string;

  @ApiPropertyOptional({ maxLength: 4 })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  logoInitials?: string;

  @ApiPropertyOptional({ example: '#2563eb' })
  @IsOptional()
  @Matches(HEX_COLOR)
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#ec4899' })
  @IsOptional()
  @Matches(HEX_COLOR)
  secondaryColor?: string;

  @ApiPropertyOptional({
    maxLength: IMAGE_MAX_LENGTH,
    description: 'Image address or inline image',
  })
  @IsOptional()
  @IsString()
  @MaxLength(IMAGE_MAX_LENGTH)
  @Matches(IMAGE_SOURCE)
  faviconUrl?: string;

  @ApiPropertyOptional({ minimum: 8, maximum: 256 })
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(256)
  logoSize?: number;

  @ApiPropertyOptional({ enum: LOGO_FITS })
  @IsOptional()
  @IsIn(LOGO_FITS)
  logoObjectFit?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 128 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(128)
  logoBorderRadius?: number;

  @ApiPropertyOptional({ minimum: 8, maximum: 256 })
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(256)
  logoContainerSize?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 128 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(128)
  logoContainerRadius?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 64 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(64)
  logoContainerPadding?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  logoBackgroundOpacity?: number;
}

/** `GET /v2/branding`: the stored branding over the defaults. */
export class BrandingV2View extends BrandingV2Dto {
  @ApiProperty({ description: 'false while the defaults apply' })
  isStored: boolean;

  @ApiProperty({ nullable: true, type: String })
  updatedAt: string | null;
}
