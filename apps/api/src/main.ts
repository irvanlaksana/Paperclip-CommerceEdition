import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

/**
 * API bootstrap.
 *
 * Binds 0.0.0.0 by default so the service is reachable inside containers and
 * sandboxed preview environments, and enables CORS for the origins listed in
 * CORS_ORIGINS (the Next.js app proxies through rewrites, so CORS is only
 * needed when a browser calls the API directly).
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.enableShutdownHooks();

  // Request bodies are validated inside the services (see
  // ContentStudioService.normalizeInput), so class-validator is not required.
  // Express JSON body parsing is enabled by default in @nestjs/platform-express.

  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length ? origins : true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization'],
    credentials: true,
  });

  const port = Number.parseInt(process.env.PORT ?? '4000', 10);
  const host = process.env.API_HOST ?? '0.0.0.0';

  await app.listen(port, host);

  logger.log(`Paperclip Commerce API siap di http://${host}:${port}`);
  logger.log(`Health check: http://${host}:${port}/health`);
  if (!process.env.AI_DEFAULT_PROVIDER) {
    logger.warn(
      'AI_DEFAULT_PROVIDER belum di-set - memakai MOCK sehingga pipeline tetap jalan tanpa API key.',
    );
  }
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Gagal menjalankan API:', err);
  process.exit(1);
});
