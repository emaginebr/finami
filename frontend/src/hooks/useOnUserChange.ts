import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";

/**
 * Chama `onChange` quando a pessoa logada sai ou é trocada (não na primeira restauração),
 * para os Contexts descartarem dados da sessão anterior.
 */
export const useOnUserChange = (onChange: () => void): number | null => {
  const { session } = useAuth();
  const userId = session?.user.userId ?? null;
  const previous = useRef<number | null>(userId);
  const callback = useRef(onChange);
  callback.current = onChange;

  useEffect(() => {
    if (previous.current !== null && previous.current !== userId) callback.current();
    previous.current = userId;
  }, [userId]);

  return userId;
};

export default useOnUserChange;
