export {};

declare module "xlsx-js-style";
declare module "jszip";

declare global {
  interface Window {
    cumplimientosBackend: {
      databasePath: () => Promise<string>;
      add: (rows: any[]) => Promise<{ inserted: number; rows: any[] }>;
      importRows?: (
        rows: any[],
      ) => Promise<{ rows: any[]; summary: any }>;
      list: () => Promise<any[]>;
      patch: (id: string, patch: Record<string, any>) => Promise<any>;
      delete: (id: string) => Promise<boolean>;
      recalculate: () => Promise<any[]>;
      updateFromSentencias: (
        rows: any[],
      ) => Promise<{ rows: any[]; summary: any }>;
      listInhabiles: () => Promise<any[]>;
      replaceInhabiles: (dias: any[]) => Promise<any[]>;
    };
    api: {
      // Auth
      bootstrapLogin: (
        username: string,
        password: string,
        remember?: boolean,
      ) => Promise<{
        ok: boolean;
        error?: string;
        token?: string;
        user?: SessionUser;
        rememberToken?: string;
        rememberTokenExpires?: string;
      }>;
      login: {
        (
          username: string,
          password: string,
          remember?: boolean,
        ): Promise<{
          ok: boolean;
          error?: string;
          token?: string;
          user?: SessionUser;
          rememberToken?: string;
          rememberTokenExpires?: string;
        }>;
        (
          url: string,
          username: string,
          password: string,
          remember?: boolean,
        ): Promise<{
          ok: boolean;
          error?: string;
          token?: string;
          user?: SessionUser;
          rememberToken?: string;
          rememberTokenExpires?: string;
        }>;
      };
      rememberLogin?: () => Promise<{
        ok: boolean;
        error?: string;
        token?: string;
        apiUrl?: string;
        user?: SessionUser;
      }>;
      verifyToken: (
        url: string,
        token: string,
      ) => Promise<{
        ok: boolean;
        user?: SessionUser;
      }>;
      clearRemoteSession?: () => void;
      checkLicense: () => Promise<LicenseStatus>;
      activateLicense: (serial: string) => Promise<{
        ok: boolean;
        error?: string;
        message?: string;
        days?: number;
        expiry?: string;
        state?: LicenseStatus;
      }>;
      generateLicense: (input: number | string | { expiry: string; machineId?: string }) => Promise<{
        ok: boolean;
        error?: string;
        serial?: string;
        days?: number;
        expiry?: string;
        machineId?: string;
      }>;
      getMachineId: () => Promise<string>;
      // Server control
      serverStart: (port: number) => Promise<{
        ok: boolean;
        port?: number;
        urls?: NetworkUrl[];
        error?: string;
      }>;
      serverStop: () => Promise<{ ok: boolean; error?: string }>;
      serverStatus: () => Promise<{
        running: boolean;
        port: number | null;
        urls: NetworkUrl[];
      }>;
      scanPorts: () => Promise<number[]>;
      networkUrls: (port: number) => Promise<NetworkUrl[]>;
      // User management
      listUsers: () => Promise<UserRecord[]>;
      createUser: (userData: {
        Usuario: string;
        Password: string;
        IdRol?: number;
        NombreCompleto?: string;
      }) => Promise<{ ok: boolean; IdUsuario?: number; error?: string }>;
      updateUser: (
        id: number,
        userData: {
          IdRol?: number;
          Activo?: boolean;
          NombreCompleto?: string;
          Password?: string;
        },
      ) => Promise<{ ok: boolean; error?: string }>;
      listRoles: () => Promise<RoleRecord[]>;
      listPermissions: () => Promise<PermissionRecord[]>;
      listRolesWithPermissions: () => Promise<RoleWithPermissionsRecord[]>;
      createRole: (roleData: {
        NombreRol: string;
        Permisos?: string[];
      }) => Promise<{ ok: boolean; IdRol?: number; error?: string }>;
      updateRole: (
        id: number,
        roleData: {
          NombreRol?: string;
          Permisos?: string[];
        },
      ) => Promise<{ ok: boolean; error?: string }>;

      // Mesas de tramite & Trabajo diario
      listMesas: () => Promise<any[]>;
      listMesasActivas: () => Promise<any[]>;
      createMesa: (data: any) => Promise<{ ok: boolean; error?: string }>;
      updateMesa: (id: any, data: any) => Promise<{ ok: boolean; error?: string }>;
      deleteMesa: (id: any) => Promise<{ ok: boolean; error?: string }>;
      importMesasCatalog: (rows: any[]) => Promise<any>;
      importMesaAssignments: (rows: any[]) => Promise<any>;
      autoAssignMesas: (userId: any, userName: any) => Promise<any>;
      reassignMesa: (data: any) => Promise<any>;
      getAssignmentHistory: (filters: any) => Promise<any>;
      getExpedientesAllMesas: () => Promise<any>;
    };
  }

  interface SessionUser {
    IdUsuario: number;
    Usuario: string;
    NombreCompleto: string;
    IdRol: number;
    Rol: string;
    Permisos?: string[];
  }

  interface LicenseStatus {
    active: boolean;
    daysLeft: number;
    msLeft?: number;
    minutesLeft?: number;
    timeLeftLabel?: string;
    serial: string;
    expired: boolean;
    noLicense: boolean;
    machineId: string;
    expiry?: string;
    lastRun?: string;
    status?: string;
    message?: string;
  }

  interface NetworkUrl {
    type: "local" | "lan";
    url: string;
  }

  interface UserRecord {
    IdUsuario: number;
    Usuario: string;
    NombreCompleto: string;
    IdRol: number;
    Rol: string;
    Activo: boolean;
    FechaCreacion: string;
  }

  interface RoleRecord {
    IdRol: number;
    NombreRol: string;
  }

  interface PermissionRecord {
    IdPermiso: string;
    NombrePermiso: string;
    Categoria: string;
  }

  interface RoleWithPermissionsRecord extends RoleRecord {
    Permisos: string[];
  }
}
