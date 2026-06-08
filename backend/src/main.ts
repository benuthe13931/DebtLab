import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const getCorsOrigins = () =>
  (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: getCorsOrigins(),
    allowedHeaders: ['Content-Type', 'x-session-token'],
  });
  
  const portStr = process.env.PORT ?? '8080';
  const port = parseInt(portStr, 10);
  
  try {
    await app.listen(port);
    console.log(`✓ Server listening on port ${port}`);
  } catch (error: any) {
    if (error.code === 'EACCES') {
      console.warn(`✗ Permission denied on port ${port}, trying port ${port + 1}...`);
      try {
        await app.listen(port + 1);
        console.log(`✓ Server listening on port ${port + 1}`);
      } catch (err2: any) {
        console.error('Failed to bind to any port:', err2.message);
        process.exit(1);
      }
    } else {
      throw error;
    }
  }
}

bootstrap();
