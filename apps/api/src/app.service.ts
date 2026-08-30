import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'autoparts-api',
      timestamp: new Date().toISOString(),
    };
  }
}
