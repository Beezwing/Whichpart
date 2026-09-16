import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true exposes req.rawBody -- needed only by the QuickBooks
  // webhook, which must verify Intuit's signature against the exact bytes
  // sent, not a re-serialized version of the parsed JSON.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  // Default CORP (same-origin) would block our own web app — a different
  // origin in dev, and commonly a different subdomain in production —
  // from even *displaying* authenticated images/documents it's allowed
  // to fetch. The actual access control is the auth check in each
  // download endpoint, not this header.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>('WEB_APP_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });
  app.setGlobalPrefix('api');

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
}
bootstrap().catch((error: unknown) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
