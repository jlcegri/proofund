import AppNavbar from "./layout/AppNavbar";
import AppRoutes from "./routes/AppRoutes";
import LanguageSync from "./i18n/LanguageSync";

function App() {
  return (
    <>
      <LanguageSync />
      <AppNavbar />
      <main className="min-h-[calc(100vh-4rem)] bg-base-200 text-base-content">
        <div className="mx-auto w-full max-w-6xl px-4 py-8">
          <AppRoutes />
        </div>
      </main>
    </>
  );
}

export default App;
