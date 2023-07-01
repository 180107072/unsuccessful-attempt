import { createContext } from "react";

export interface PresenceContextProps {
  id: string;
  isPresent: boolean;
  register: (id: string | number) => () => void;
  onExitComplete?: (id: string | number) => void;
  initial?: false;
  custom?: any;
}

export const PresenceContext = createContext<PresenceContextProps | null>(null);
