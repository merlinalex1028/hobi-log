import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { DatabaseRetryInterceptor } from './common/interceptors/database-retry.interceptor'
import { createValidationPipe } from './common/pipes/create-validation-pipe'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true })
  app.useGlobalPipes(createValidationPipe())
  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalInterceptors(new DatabaseRetryInterceptor())

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HobiLog API')
    .setVersion('0.1')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  await app.listen(Number(process.env.PORT ?? 3000))
}

void bootstrap()
