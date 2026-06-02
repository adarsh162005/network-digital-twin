import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const Ctx = createContext({ scenarios: [], names: [], refresh: async () => {}, loading: false });

export function ScenariosProvider({ children }) {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/scenarios");
      setScenarios(data.scenarios || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <Ctx.Provider value={{ scenarios, names: scenarios.map((s) => s.name), refresh, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useScenarios() {
  return useContext(Ctx);
}
