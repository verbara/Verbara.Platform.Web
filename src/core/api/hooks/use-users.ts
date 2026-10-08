import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch, customFetchWithHeaders } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { isApiError, type ApiErrorMap } from '@/core/api/api-error';
import { toastApiError } from '@/core/api/toast-api-error';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/** Server response is the named `UserDto` schema (openapi-response-adoption, Platform/ADR-0035).
 *  mfaEnabled/lastLoginAt/authProvider are optional client-display fields the DTO does not (yet)
 *  emit; retained as an extension so the admin user-detail UI keeps compiling until they surface. */
export type User = components['schemas']['UserDto'] & {
  mfaEnabled?: boolean;
  lastLoginAt?: string;
  authProvider?: string;
};

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const result = await customFetch<components['schemas']['PagedResultOfUserDto']>({
        url: '/api/v1/admin/users',
        method: 'GET',
        params: { page: '1', pageSize: '100' },
      });
      return result.items;
    },
  });
}

/** A user as read, with the version Platform sent for it (design D6). */
export interface VersionedUser {
  readonly user: User;
  /** The strong `ETag` of the read, or `null` when there was none or only a weak one. */
  readonly etag: string | null;
}

/**
 * The `ETag` worth sending back in `If-Match`, or `null`. Platform compares `If-Match` strongly, so
 * a weak tag (`W/"…"`, what a compressing proxy turns a strong one into) never matches: sending it
 * would turn every save into a 412. A weak or absent tag is treated as no tag.
 */
export function strongEtagOf(headers: Headers): string | null {
  const etag = headers.get('ETag')?.trim();
  if (!etag || /^W\//i.test(etag)) return null;
  return etag;
}

function useVersionedUserQuery<T>(id: string | undefined, select: (v: VersionedUser) => T) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async (): Promise<VersionedUser> => {
      const { data, headers } = await customFetchWithHeaders<User>({
        url: `/api/v1/admin/users/${id}`,
        method: 'GET',
      });
      return { user: data, etag: strongEtagOf(headers) };
    },
    enabled: !!id,
    select,
  });
}

const selectUser = (v: VersionedUser) => v.user;
const selectEtag = (v: VersionedUser) => v.etag;

export function useUser(id: string | undefined) {
  return useVersionedUserQuery(id, selectUser);
}

/** The strong `ETag` of the cached read of user `id` (same query as {@link useUser}). */
export function useUserEtag(id: string | undefined) {
  return useVersionedUserQuery(id, selectEtag);
}

/**
 * The update's refusals (ADR-0013). Only a 412 (the user changed after the form read it) is routed
 * through this map today; any other refusal keeps the client's message, as before this change.
 */
export const USER_UPDATE_ERRORS: ApiErrorMap = {
  statuses: { 412: { code: 'user-changed', key: 'admin:users.errors.user_changed' } },
  fallback: { code: 'user-update-failed', key: 'common:errors.route_error_fallback' },
};

export function useCreateUser() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    // `CreateUserRequest` has no status (every new account is `Active`), so the body is built from
    // the fields the endpoint takes rather than from whatever the caller passes.
    mutationFn: (input: { email: string; displayName: string; role: string }) =>
      customFetch<User>({
        url: '/api/v1/admin/users',
        method: 'POST',
        data: { email: input.email, displayName: input.displayName, role: input.role },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('toasts.users.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface UpdateUserInput {
  id: string;
  displayName?: string;
  /**
   * Platform's `UserRole` name. Omit it to leave the role unchanged. `role` and `status` are typed
   * from `UpdateUserRequest`'s enums so a rename fails the build; an omitted value is absent from
   * the body, never `null`.
   */
  role?: NonNullable<components['schemas']['UserRole']>;
  /** Platform's `UserStatus` name. Omit it to leave the status unchanged. */
  status?: NonNullable<components['schemas']['UserStatus']>;
  /**
   * The strong `ETag` the edit started from ({@link useUserEtag}). Sent as `If-Match` only when
   * present and strong; a weak or absent tag sends no precondition (design D6).
   */
  etag?: string | null;
}

export function useUpdateUser() {
  const qc = useQueryClient();
  const { t } = useTranslation(['common', 'admin']);
  return useMutation({
    // The body is built from the fields `UpdateUserRequest` takes, so a caller's extra value (an
    // email, which the endpoint ignores) never reaches it (H2).
    mutationFn: ({ id, displayName, role, status, etag }: UpdateUserInput) => {
      const data = {
        ...(displayName !== undefined && { displayName }),
        ...(role !== undefined && { role }),
        ...(status !== undefined && { status }),
      };
      const strong = etag && !/^W\//i.test(etag.trim()) ? etag : null;
      return customFetch<User>({
        url: `/api/v1/admin/users/${id}`,
        method: 'PUT',
        data,
        ...(strong && { headers: { 'If-Match': strong } }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('common:toasts.users.updated'));
    },
    onError: (err: Error) => {
      if (isApiError(err) && err.status === 412) {
        // Someone else changed the user after this form read it: nothing was written. Read the
        // user and the list again, so the next edit starts from the current values.
        qc.invalidateQueries({ queryKey: ['users'] });
        toastApiError(err, USER_UPDATE_ERRORS, t);
        return;
      }
      toast.error(err.message);
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/users/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('toasts.users.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
