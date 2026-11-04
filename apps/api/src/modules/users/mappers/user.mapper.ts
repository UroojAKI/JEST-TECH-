import { UserResponseDto } from '../dto/user-response.dto';

export class UserMapper {
  static toResponse(user: any): UserResponseDto {
    const clientCodes = user.agentProfile?.externalCodes?.map((code: any) => ({
      id: code.id,
      value: code.externalCode,
      codeSystem: code.codeSystem,
      verificationStatus: code.verificationStatus,
      isPrimary: code.isPrimary,
    })) || [];
    const primaryVerifiedCode = clientCodes.find(
      (code) => code.isPrimary && code.verificationStatus === 'VERIFIED',
    ) || clientCodes.find((code) => code.verificationStatus === 'VERIFIED');
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      collectContacts: user.collectContacts ?? false,
      employeeCode: user.employeeCode,
      agentCode: primaryVerifiedCode?.value || null,
      clientCodes,
      agentProfile: user.agentProfile ? { id: user.agentProfile.id } : null,
      designation: user.designation,
      department: user.legacyDepartment,
      branchId: user.branch?.id,
      branchName: user.branch?.name,
      teamName: user.team?.name,
      status: user.status,
      role: {
        id: user.role.id,
        name: user.role.name,
        code: user.role.code,
      },
      lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
      createdAt: user.createdAt,
    };
  }

  static toResponseList(users: any[]): UserResponseDto[] {
    return users.map((user) => this.toResponse(user));
  }
}
