export interface WorkspaceResponseDto {
  user: {
    id: string;
    employeeCode: string | null;
    firstName: string;
    lastName: string;
    email: string;
    designation: string | null;
    status: string;
  };
  jobRole: {
    id: string;
    code: string;
    name: string;
    defaultRoleType: string;
    description: string | null;
  } | null;
  department: {
    id: string;
    code: string;
    name: string;
  } | null;
  dashboardCode: string;
  workspaceCode: string;
  title: string;
  subtitle: string | null;
  navigation: any[];
  widgets: any[];
  quickActions: any[];
  permissions: any[];
  preferences?: any;
}
