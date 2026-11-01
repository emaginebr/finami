import { useContext } from "react";
import NotificationContext from "../Contexts/NotificationContext";

/** Acesso ao NotificationContext. Lança erro se usado fora do `NotificationProvider`. */
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotification must be used within a NotificationProvider");
  return context;
};

export default useNotification;
