import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ScenariosProvider } from "@/lib/scenarios";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import CurrentPrediction from "@/pages/CurrentPrediction";
import FutureForecasting from "@/pages/FutureForecasting";
import Compare from "@/pages/Compare";
import History from "@/pages/History";
import Recommendations from "@/pages/Recommendations";
import SystemHealth from "@/pages/SystemHealth";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} richColors closeButton />;
}

function App() {
  return (
    <ThemeProvider>
      <ScenariosProvider>
        <div className="App min-h-screen" data-testid="app-root">
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/current" element={<CurrentPrediction />} />
                <Route path="/future" element={<FutureForecasting />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/history" element={<History />} />
                <Route path="/recommendations" element={<Recommendations />} />
                <Route path="/health" element={<SystemHealth />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <ThemedToaster />
        </div>
      </ScenariosProvider>
    </ThemeProvider>
  );
}

export default App;
