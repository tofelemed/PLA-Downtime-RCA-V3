import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';

/** A user as the v1 API returns it: every column except the password hash. */
export type UserPublicView = Omit<User, 'passwordHash'>;

/** Strips the secret at the boundary; every user-returning v1 route and broadcast maps through here. */
export function toPublicUser(user: User): UserPublicView {
  const { passwordHash: _secret, ...rest } = user;
  void _secret;
  return rest;
}

/** `GET /users/assignable`: the minimum the Tasks assignee picker needs, readable by any member. */
export class AssignableUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}
