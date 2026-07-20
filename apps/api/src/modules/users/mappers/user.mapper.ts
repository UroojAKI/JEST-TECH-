import { UserResponseDto } from '../dto/user-response.dto';

export class UserMapper {
  static toResponse(user: any): UserResponseDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      employeeCode: user.employeeCode,
      designation: user.designation,
      department: user.legacyDepartment,
      status: user.status,
      role: {
        id: user.role.id,
        name: user.role.name,
        code: user.role.code,
      },
      createdAt: user.createdAt,
    };
  }

  static toResponseList(users: any[]): UserResponseDto[] {
    return users.map((user) => this.toResponse(user));
  }
}
