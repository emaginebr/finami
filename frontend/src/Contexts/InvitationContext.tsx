import { createContext, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { invitationService } from "../Services/invitationService";
import type { GroupInfo } from "../types/group";
import type { GroupInvitationInfo, MemberLookupResult, NewMemberInfo } from "../types/invitation";
import { OFFLINE_CONTENT_MESSAGE } from "../types/api";
import { errorMessage } from "../utils/notify";
import { useOnUserChange } from "../hooks/useOnUserChange";

export interface InvitationContextType {
  // Estado
  loading: boolean;
  error: string | null;
  /** O último erro foi "sem internet e sem dado guardado" (feature 005) */
  offline: boolean;
  // Métodos (lançam `ApiError`; quem chama decide como exibir)
  lookupMember: (groupId: number, email: string) => Promise<MemberLookupResult>;
  createMember: (groupId: number, info: NewMemberInfo) => Promise<GroupInfo>;
  invite: (groupId: number, email: string) => Promise<GroupInvitationInfo>;
  listPending: (groupId: number) => Promise<GroupInvitationInfo[]>;
  cancel: (groupId: number, invitationId: number) => Promise<GroupInvitationInfo>;
  accept: (invitationId: number) => Promise<GroupInvitationInfo>;
  decline: (invitationId: number) => Promise<GroupInvitationInfo>;
  clearError: () => void;
}

const InvitationContext = createContext<InvitationContextType | undefined>(undefined);

/**
 * Convites e inclusão de membros (specs/003 data-model "Frontend — estado").
 * Não guarda listas: a família recarrega membros/pendentes e a tela de notificações
 * atualiza o estado do convite após cada operação.
 */
export const InvitationProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useOnUserChange(() => {
    setError(null);
  });

  /** Executa a chamada controlando `loading`/`error`; repassa o erro a quem chamou */
  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    try {
      setLoading(true);
      setError(null);
      return await operation();
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const lookupMember = useCallback(
    (groupId: number, email: string) => run(() => invitationService.lookupMember(groupId, email)),
    [run],
  );

  const createMember = useCallback(
    (groupId: number, info: NewMemberInfo) => run(() => invitationService.createMember(groupId, info)),
    [run],
  );

  const invite = useCallback(
    (groupId: number, email: string) => run(() => invitationService.invite(groupId, email)),
    [run],
  );

  const listPending = useCallback(
    (groupId: number) => run(() => invitationService.listPending(groupId)),
    [run],
  );

  const cancel = useCallback(
    (groupId: number, invitationId: number) => run(() => invitationService.cancel(groupId, invitationId)),
    [run],
  );

  const accept = useCallback(
    (invitationId: number) => run(() => invitationService.accept(invitationId)),
    [run],
  );

  const decline = useCallback(
    (invitationId: number) => run(() => invitationService.decline(invitationId)),
    [run],
  );

  const clearError = useCallback(() => setError(null), []);
  const offline = error === OFFLINE_CONTENT_MESSAGE;

  const value = useMemo<InvitationContextType>(
    () => ({
      loading,
      error,
      offline,
      lookupMember,
      createMember,
      invite,
      listPending,
      cancel,
      accept,
      decline,
      clearError,
    }),
    [loading, error, offline, lookupMember, createMember, invite, listPending, cancel, accept, decline, clearError],
  );

  return <InvitationContext.Provider value={value}>{children}</InvitationContext.Provider>;
};

export default InvitationContext;
