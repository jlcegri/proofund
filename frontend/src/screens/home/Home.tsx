import { useNavigate } from "react-router-dom";
import "./styles.css";

function Home() {

  const navigate = useNavigate();

  return (
    <main className="home">
      <section className="home-hero">
        <div className="home-hero-content">
          <span className="home-badge">Decentralized crowdfunding</span>

          <h1>Welcome to Proofund!</h1>

          <p>
            Proofund allows users to create and support crowdfunding campaigns
            using smart contracts and decentralized metadata storage through IPFS.
          </p>

          <div className="home-actions">
            <button
              className="home-primary-button"
              onClick={() => navigate("/campaigns/create")}
            >
              Create campaign
            </button>

            <button
              className="home-secondary-button"
              onClick={() => navigate("/campaigns/explore")}
            >
              Explore campaigns
            </button>
          </div>
        </div>

        <div className="home-hero-card">
          <h2>How it works</h2>

          <div className="home-step">
            <strong>1. Create</strong>
            <span>Upload campaign metadata and define the funding goal.</span>
          </div>

          <div className="home-step">
            <strong>2. Fund</strong>
            <span>Users contribute directly through the smart contract.</span>
          </div>

          <div className="home-step">
            <strong>3. Settle</strong>
            <span>Funds are withdrawn or refunded depending on the result.</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;
