import { useMemo } from "react";

import { MOCK_SNAPSHOT } from "../domain/mockData";
import { AppRole } from "../domain/types";

export function useSnapshot(_role: AppRole) {
  return useMemo(() => MOCK_SNAPSHOT, []);
}
