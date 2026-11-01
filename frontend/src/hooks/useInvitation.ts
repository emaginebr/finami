import { useContext } from "react";
import InvitationContext from "../Contexts/InvitationContext";

/** Acesso ao InvitationContext. Lança erro se usado fora do `InvitationProvider`. */
export const useInvitation = () => {
  const context = useContext(InvitationContext);
  if (!context) throw new Error("useInvitation must be used within an InvitationProvider");
  return context;
};

export default useInvitation;
