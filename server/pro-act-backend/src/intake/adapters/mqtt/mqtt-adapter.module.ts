import { Module } from '@nestjs/common';
import { IntakeModule } from '../../intake.module';
import { MqttAdapter } from './mqtt.adapter';

/** Registers the MQTT adapter with the intake core (plan 1.8); the subscriber host joins in step 3. */
@Module({
  imports: [IntakeModule],
  providers: [MqttAdapter],
  exports: [MqttAdapter],
})
export class MqttAdapterModule {}
