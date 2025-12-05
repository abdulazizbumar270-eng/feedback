import React from "react";
import '../styles/Home.css';

const Home = () => {
  const users = ["John Doe", "Jane Smith", "Alice Johnson", "Bob Brown"];

  return (
    <div className="home-container">
      <header className="home-header">
        <h1>Welcome to Your Online Suggestion Box</h1>
        <p>Feel free to drop your suggestions and feedback instantly!</p>
      </header>

    
    </div>
  );
};

export default Home;