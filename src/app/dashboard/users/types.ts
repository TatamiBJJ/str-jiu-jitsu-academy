export type UserRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "coach"
  | "parent"
  | "student";

export type AssignableRole = Exclude<
  UserRole,
  "super_admin"
>;

export type AccountStatus =
  | "active"
  | "inactive"
  | "pending"
  | "email_unconfirmed";

export interface AdminUser {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email_confirmed: boolean;
  registered_at: string;
  last_sign_in_at: string | null;
  roles: UserRole[];
  active_roles: UserRole[];
  account_status: AccountStatus;
}

export interface UserMembership {
  member_id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface UserWithMemberships extends AdminUser {
  memberships: UserMembership[];
}

export type RoleFilter = UserRole | "all";

export type StatusFilter = AccountStatus | "all";

export type ActionResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      message: string;
    };

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Администратор",
  manager: "Менеджер",
  coach: "Тренер",
  parent: "Родитель",
  student: "Ученик",
};

export const ACCOUNT_STATUS_LABELS: Record<
  AccountStatus,
  string
> = {
  active: "Активен",
  inactive: "Доступ отключён",
  pending: "Ожидает подтверждения",
  email_unconfirmed: "Email не подтверждён",
};

export const ASSIGNABLE_ROLES: readonly AssignableRole[] = [
  "admin",
  "manager",
  "coach",
  "parent",
  "student",
];