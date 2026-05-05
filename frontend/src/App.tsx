import AppNavbar from "./layout/AppNavbar";
import AppRoutes from "./routes/AppRoutes";
import LanguageSync from "./i18n/LanguageSync";

function App() {
  return (
    <>
      <LanguageSync />
      <AppNavbar />
      <main className="app-main">
        <AppRoutes />
      </main>
    </>
  );
}

export default App;
