import type { AgencyType, User, UserRole } from "@/context/AuthContext";
import { mobileApiFetch } from "@/services/apiClient";
import { shouldUseApi } from "@/services/apiConfig";

/**
 * Admin user-management repository. API-first when API mode is on (bearer token
 * attached automatically by apiClient), with a local/mock fallback so the demo
 * keeps working offline and when the backend is unavailable or returns 401/403.
 *
 * The backend auth model is lean (badge + displayName + agency + role + active);
 * contact fields (email/phone/sector/station) are only tracked locally, so when
 * a user is created/updated through the API those local-only fields are simply
 * not sent. PIN hashes are never returned by the backend.
 */

/** Safe view returned by the backend (never includes a PIN hash). */
interface AdminUserView {
  id: string;
  badgeNumber: string;
  displayName: string;
  agency: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
}

/** Local user-management primitives (the existing AuthContext methods). */
export interface UserRepositoryLocalAdapter {
  list: () => User[];
  /** Display-only merge of backend users into the in-memory store (no persist). */
  merge?: (users: User[]) => void;
  create: (newUser: Omit<User, "id" | "createdAt">, pin: string) => Promise<void>;
  update: (id: string, patch: Partial<Omit<User, "id" | "createdAt">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  resetPin: (id: string, pin: string) => Promise<void>;
}

function mapToUser(view: AdminUserView): User {
  return {
    id: view.id,
    name: view.displayName,
    badgeNumber: view.badgeNumber,
    email: "",
    role: view.role,
    sector: "",
    station: "",
    phone: "",
    status: view.isActive ? "active" : "inactive",
    createdAt: view.createdAt ?? new Date().toISOString(),
    agency: view.agency,
  };
}

/**
 * Load users. In API mode, fetch from the backend and merge them into the local
 * store (so edit/lookup keep working); on any failure fall back to local users.
 */
export async function listUsers(local: UserRepositoryLocalAdapter): Promise<User[]> {
  if (shouldUseApi()) {
    const api = await mobileApiFetch<{ users?: AdminUserView[] }>({
      method: "GET",
      path: "/admin/users",
      requireAuth: true,
    });
    if (api.ok) {
      const users = (api.data.users ?? []).map(mapToUser);
      local.merge?.(users);
      return users;
    }
  }
  return local.list();
}

export async function createUser(
  newUser: Omit<User, "id" | "createdAt">,
  pin: string,
  local: UserRepositoryLocalAdapter,
): Promise<void> {
  if (shouldUseApi()) {
    const api = await mobileApiFetch<{ user?: AdminUserView }, Record<string, unknown>>({
      method: "POST",
      path: "/admin/users",
      requireAuth: true,
      body: {
        badgeNumber: newUser.badgeNumber,
        displayName: newUser.name,
        agency: newUser.agency,
        role: newUser.role,
        pin,
        isActive: newUser.status === "active",
      },
    });
    if (api.ok) return;
  }
  await local.create(newUser, pin);
}

export async function updateUser(
  id: string,
  patch: Partial<Omit<User, "id" | "createdAt">>,
  local: UserRepositoryLocalAdapter,
): Promise<void> {
  if (shouldUseApi()) {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.displayName = patch.name;
    if (patch.agency !== undefined) body.agency = patch.agency;
    if (patch.role !== undefined) body.role = patch.role;
    if (patch.status !== undefined) body.isActive = patch.status === "active";
    if (Object.keys(body).length > 0) {
      const api = await mobileApiFetch<{ user?: AdminUserView }, Record<string, unknown>>({
        method: "PATCH",
        path: `/admin/users/${encodeURIComponent(id)}`,
        requireAuth: true,
        body,
      });
      if (api.ok) return;
    }
  }
  await local.update(id, patch);
}

export async function deactivateUser(id: string, local: UserRepositoryLocalAdapter): Promise<void> {
  if (shouldUseApi()) {
    const api = await mobileApiFetch<{ ok?: boolean }>({
      method: "DELETE",
      path: `/admin/users/${encodeURIComponent(id)}`,
      requireAuth: true,
    });
    if (api.ok) return;
  }
  await local.update(id, { status: "inactive" });
}

/**
 * "Delete" a user. The backend has soft-delete semantics (deactivate, never a
 * hard delete); the local/offline store keeps its existing hard-delete behaviour.
 */
export async function removeUser(id: string, local: UserRepositoryLocalAdapter): Promise<void> {
  if (shouldUseApi()) {
    const api = await mobileApiFetch<{ ok?: boolean }>({
      method: "DELETE",
      path: `/admin/users/${encodeURIComponent(id)}`,
      requireAuth: true,
    });
    if (api.ok) return;
  }
  await local.remove(id);
}

export async function reactivateUser(id: string, local: UserRepositoryLocalAdapter): Promise<void> {
  if (shouldUseApi()) {
    const api = await mobileApiFetch<{ user?: AdminUserView }, Record<string, unknown>>({
      method: "PATCH",
      path: `/admin/users/${encodeURIComponent(id)}`,
      requireAuth: true,
      body: { isActive: true },
    });
    if (api.ok) return;
  }
  await local.update(id, { status: "active" });
}

export async function resetPin(id: string, pin: string, local: UserRepositoryLocalAdapter): Promise<void> {
  if (shouldUseApi()) {
    const api = await mobileApiFetch<{ ok?: boolean }, { pin: string }>({
      method: "POST",
      path: `/admin/users/${encodeURIComponent(id)}/reset-pin`,
      requireAuth: true,
      body: { pin },
    });
    if (api.ok) return;
  }
  await local.resetPin(id, pin);
}

export type { AgencyType };
