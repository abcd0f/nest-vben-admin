import { Injectable } from '@nestjs/common';
import { hashPassword, verifyPassword } from './password.js';

@Injectable()
export class AuthService {
  hashPassword = hashPassword;
  verifyPassword = verifyPassword;
}
