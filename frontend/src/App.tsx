import AppNavbar from "./layout/AppNavbar";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <>
    <AppNavbar />
    <main className="app-main">
      <AppRoutes />
    </main>
    </>
  );
}

export default App;