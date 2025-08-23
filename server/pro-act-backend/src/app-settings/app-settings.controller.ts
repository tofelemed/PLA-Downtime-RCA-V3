import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { AppSettings } from './app-settings.entity';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAppSettingsDto } from './dto/create-app-settings.dto';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';

@ApiTags('App Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('app-settings')
export class AppSettingsController {
  constructor(private readonly settingsService: AppSettingsService) {}

  @Get()
  findAll(): Promise<AppSettings[]> {
    return this.settingsService.findAll();
  }

  @Get(':key')
  findOne(@Param('key') key: string): Promise<AppSettings | null> {
    return this.settingsService.findOne(key);
  }

  @Post()
  @ApiBody({ type: CreateAppSettingsDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateAppSettingsDto): Promise<AppSettings> {
    return this.settingsService.create(data);
  }

  @Put(':key')
  @ApiBody({ type: UpdateAppSettingsDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('key') key: string, @Body() data: UpdateAppSettingsDto): Promise<AppSettings | null> {
    return this.settingsService.update(key, data);
  }

  @Delete(':key')
  remove(@Param('key') key: string): Promise<void> {
    return this.settingsService.remove(key);
  }

  @Post(':key/value')
  setValue(@Param('key') key: string, @Body() body: { value: any }): Promise<AppSettings> {
    return this.settingsService.setValue(key, body.value);
  }

  @Get(':key/value')
  getValue(@Param('key') key: string): Promise<any> {
    return this.settingsService.getValue(key);
  }
} 