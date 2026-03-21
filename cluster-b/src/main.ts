import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../module/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   CLUSTER B — Products Service (NestJS)  ║');
  console.log(`║   Running on http://localhost:${port}        ║`);
  console.log('║   Simulates an internal GKE microservice  ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET http://localhost:${port}/products`);
  console.log(`  GET http://localhost:${port}/products/:id`);
  console.log(`  GET http://localhost:${port}/products?category=electronics`);
  console.log(`  GET http://localhost:${port}/health`);
  console.log('');
}

bootstrap();
