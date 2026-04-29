import "./styles.css";

function Home() {
  return (
    <main className="home">
      <section className="home-hero">
        <div className="home-hero-content">
          <span className="home-badge">Decentralized crowdfunding</span>

          <h1>Fund transparent campaigns with blockchain</h1>

          <p>
            Proofund allows users to create and support crowdfunding campaigns
            using smart contracts and decentralized metadata storage through IPFS.
          </p>

          <div className="home-actions">
            <button className="home-primary-button">
              Create campaign
            </button>

            <button className="home-secondary-button">
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

      <section className="home-section">
        <h2>Featured campaigns</h2>
        <p>
          Recently created campaigns will appear here with their image, title and
          description.
        </p>
      </section>
    </main>
  );
}

export default Home;