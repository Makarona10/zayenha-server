import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from './interfaces/users.interface';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(user: User, hash: string) {
    user.email = user.email.toLowerCase();
    try {
      const existingUser = await this.findUser(user.email);
      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      return this.prisma.user.create({
        data: { ...user, password: hash },
      });
    } catch (error) {
      throw new HttpException(
        error?.message || 'Internal server error',
        error?.status || 500,
      );
    }
  }

  async findUser(email: string): Promise<User> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }
}
