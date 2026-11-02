import { createContext, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { groupService } from "../Services/groupService";
import type { GroupInfo, GroupInsertInfo, GroupUpdateInfo } from "../types/group";
import { OFFLINE_CONTENT_MESSAGE } from "../types/api";
import { errorMessage } from "../utils/notify";
import { useOnUserChange } from "../hooks/useOnUserChange";

export interface GroupContextType {
  // Estado
  groups: GroupInfo[];
  loading: boolean;
  error: string | null;
  /** O último erro foi "sem internet e sem dado guardado" (feature 005) */
  offline: boolean;
  // Métodos
  loadGroups: () => Promise<void>;
  getGroup: (groupId: number) => Promise<GroupInfo>;
  createGroup: (data: GroupInsertInfo) => Promise<GroupInfo>;
  updateGroup: (groupId: number, data: GroupUpdateInfo) => Promise<GroupInfo>;
  addMember: (groupId: number, userId: number) => Promise<void>;
  removeMember: (groupId: number, userId: number) => Promise<void>;
  clearError: () => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

const upsert = (list: GroupInfo[], group: GroupInfo): GroupInfo[] =>
  list.some((item) => item.groupId === group.groupId)
    ? list.map((item) => (item.groupId === group.groupId ? group : item))
    : [...list, group];

export const GroupProvider = ({ children }: { children: ReactNode }) => {
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useOnUserChange(() => {
    setGroups([]);
    setError(null);
  });

  const handleError = useCallback((err: unknown): never => {
    setError(errorMessage(err));
    throw err;
  }, []);

  const loadGroups = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setGroups(await groupService.list());
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const getGroup = useCallback(
    async (groupId: number): Promise<GroupInfo> => {
      try {
        setError(null);
        const group = await groupService.get(groupId);
        setGroups((prev) => upsert(prev, group));
        return group;
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError],
  );

  const createGroup = useCallback(
    async (data: GroupInsertInfo): Promise<GroupInfo> => {
      try {
        setError(null);
        const group = await groupService.create(data);
        setGroups((prev) => upsert(prev, group));
        return group;
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError],
  );

  const updateGroup = useCallback(
    async (groupId: number, data: GroupUpdateInfo): Promise<GroupInfo> => {
      try {
        setError(null);
        const group = await groupService.update(groupId, data);
        setGroups((prev) => upsert(prev, group));
        return group;
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError],
  );

  const addMember = useCallback(
    async (groupId: number, userId: number): Promise<void> => {
      try {
        setError(null);
        await groupService.addMember(groupId, { userId });
        const group = await groupService.get(groupId);
        setGroups((prev) => upsert(prev, group));
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const removeMember = useCallback(
    async (groupId: number, userId: number): Promise<void> => {
      try {
        setError(null);
        await groupService.removeMember(groupId, userId);
        setGroups((prev) =>
          prev.map((group) =>
            group.groupId === groupId
              ? { ...group, members: group.members.filter((m) => m.userId !== userId) }
              : group,
          ),
        );
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const clearError = useCallback(() => setError(null), []);
  const offline = error === OFFLINE_CONTENT_MESSAGE;

  const value = useMemo<GroupContextType>(
    () => ({
      groups,
      loading,
      error,
      offline,
      loadGroups,
      getGroup,
      createGroup,
      updateGroup,
      addMember,
      removeMember,
      clearError,
    }),
    [groups, loading, error, offline, loadGroups, getGroup, createGroup, updateGroup, addMember, removeMember, clearError],
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};

export default GroupContext;
