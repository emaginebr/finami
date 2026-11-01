import { createContext, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { userService } from "../Services/userService";
import type {
  PasswordChangeInfo,
  UserInfo,
  UserInsertInfo,
  UserSearchInfo,
  UserUpdateInfo,
} from "../types/user";
import { errorMessage } from "../utils/notify";
import { useOnUserChange } from "../hooks/useOnUserChange";

export interface UserContextType {
  // Estado
  /** Pessoas cadastradas por quem está logado */
  createdByMe: UserInfo[];
  loading: boolean;
  error: string | null;
  // Métodos
  loadCreatedByMe: () => Promise<void>;
  createUser: (data: UserInsertInfo) => Promise<UserInfo>;
  updateUser: (userId: number, data: UserUpdateInfo) => Promise<UserInfo>;
  changePassword: (userId: number, data: PasswordChangeInfo) => Promise<void>;
  searchByEmail: (email: string) => Promise<UserSearchInfo | null>;
  clearError: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [createdByMe, setCreatedByMe] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useOnUserChange(() => {
    setCreatedByMe([]);
    setError(null);
  });

  const handleError = useCallback((err: unknown): never => {
    setError(errorMessage(err));
    throw err;
  }, []);

  const loadCreatedByMe = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setCreatedByMe(await userService.createdByMe());
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const createUser = useCallback(
    async (data: UserInsertInfo): Promise<UserInfo> => {
      try {
        setError(null);
        const user = await userService.create(data);
        setCreatedByMe((prev) => [...prev, user]);
        return user;
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError],
  );

  const updateUser = useCallback(
    async (userId: number, data: UserUpdateInfo): Promise<UserInfo> => {
      try {
        setError(null);
        const user = await userService.update(userId, data);
        setCreatedByMe((prev) => prev.map((item) => (item.userId === userId ? user : item)));
        return user;
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError],
  );

  const changePassword = useCallback(
    async (userId: number, data: PasswordChangeInfo): Promise<void> => {
      try {
        setError(null);
        await userService.changePassword(userId, data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const searchByEmail = useCallback(
    async (email: string): Promise<UserSearchInfo | null> => {
      try {
        setError(null);
        return await userService.searchByEmail(email);
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<UserContextType>(
    () => ({
      createdByMe,
      loading,
      error,
      loadCreatedByMe,
      createUser,
      updateUser,
      changePassword,
      searchByEmail,
      clearError,
    }),
    [createdByMe, loading, error, loadCreatedByMe, createUser, updateUser, changePassword, searchByEmail, clearError],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export default UserContext;
